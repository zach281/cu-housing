-- =============================================================================
-- Schema + Row Level Security tests.
-- Runs in one transaction and rolls back, so it is safe against a local
-- Supabase database (never run it against production).
--   npm run test:db            (plain Postgres + stubs, see scripts/test-db.sh)
--   psql "$LOCAL_DB_URL" -f supabase/tests/rls.test.sql   (after `supabase start`)
-- Any failing assertion aborts with an error naming the test.
-- =============================================================================
\set ON_ERROR_STOP on
\o /dev/null
begin;

-- ---------------------------------------------------------------------------
-- Test helpers (security invoker: run as whichever role is current)
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end $$;

-- Assert a statement fails (any of the listed SQLSTATEs, default: any error).
create function tests.throws(name text, stmt text, codes text[] default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL [%]: expected an error, statement succeeded', name;
exception when others then
  if sqlerrm like 'FAIL [%' then raise; end if;
  if codes is not null and not (sqlstate = any(codes)) then
    raise exception 'FAIL [%]: expected % but got % (%)', name, codes, sqlstate, sqlerrm;
  end if;
end $$;

-- Assert a statement affects exactly n rows.
create function tests.affects(name text, stmt text, n int) returns void language plpgsql as $$
declare got int;
begin
  execute stmt;
  get diagnostics got = row_count;
  if got <> n then raise exception 'FAIL [%]: expected % row(s), got %', name, n, got; end if;
end $$;

create function tests.ok(name text, cond boolean) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL [%]', name; end if;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- Fixed ids for readability
--   alice  student, confirmed @colorado.edu
--   bob    provider, confirmed gmail
--   mal    unconfirmed @colorado.edu, tried to self-assign admin
--   adm    admin
--   sam    suspended
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@colorado.edu', now(), '{"name":"Alice Buff"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@gmail.com',      now(), '{"name":"Bob Landlord","intended_role":"provider"}'),
  ('00000000-0000-0000-0000-00000000000c', 'mal@colorado.edu',   null,  '{"name":"Mal","intended_role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000d', 'admin@example.com',  now(), '{"name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000e', 'sam@colorado.edu',   now(), '{"name":"Sam"}');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000d';
update public.profiles set account_status = 'suspended', suspended_at = now() where id = '00000000-0000-0000-0000-00000000000e';

-- ===========================================================================
-- Profiles & verification
-- ===========================================================================
select tests.ok('profile auto-created for every auth user', (select count(*) = 5 from public.profiles));
select tests.ok('confirmed CU email → cu_verified',
  (select verification_status = 'cu_verified' and role = 'student' and name = 'Alice Buff'
   from public.profiles where id = '00000000-0000-0000-0000-00000000000a'));
select tests.ok('provider intent honored, gmail not CU verified',
  (select verification_status = 'unverified' and role = 'provider' from public.profiles where id = '00000000-0000-0000-0000-00000000000b'));
select tests.ok('admin cannot be self-assigned at sign-up; unconfirmed CU email not verified',
  (select role = 'student' and verification_status = 'unverified' from public.profiles where id = '00000000-0000-0000-0000-00000000000c'));

update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000000c';
select tests.ok('confirming a CU email verifies the profile',
  (select verification_status = 'cu_verified' from public.profiles where id = '00000000-0000-0000-0000-00000000000c'));

update auth.users set email = 'alice@gmail.com' where id = '00000000-0000-0000-0000-00000000000a';
select tests.ok('moving off a CU email removes CU verification',
  (select verification_status = 'unverified' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'));
update auth.users set email = 'alice@colorado.edu' where id = '00000000-0000-0000-0000-00000000000a';

update public.profiles set provider_verified_at = now() where id = '00000000-0000-0000-0000-00000000000b';
select tests.ok('provider verification outranks unverified',
  (select verification_status = 'provider_verified' from public.profiles where id = '00000000-0000-0000-0000-00000000000b'));

select tests.ok('account_created event recorded per signup',
  (select count(*) = 5 from public.analytics_events where event_name = 'account_created'));

select tests.ok('profiles never store email',
  not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name like '%email%'));

-- Accounts that predate the profile trigger can repair themselves (and only themselves)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'early@colorado.edu', now(), '{"name":"Early Bird","intended_role":"provider"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'other@gmail.com', now(), '{}');
delete from public.profiles where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
select tests.login('00000000-0000-0000-0000-0000000000f1');
select tests.ok('ensure_my_profile returns the rebuilt profile',
  (select (public.ensure_my_profile()).name = 'Early Bird'));
reset role;
select tests.ok('ensure_my_profile rebuilds a missing profile from auth data',
  (select name = 'Early Bird' and role = 'provider' and verification_status = 'cu_verified'
   from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'));
select tests.ok('ensure_my_profile does not touch other accounts',
  not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000f2'));
select tests.login('00000000-0000-0000-0000-0000000000f1');
select public.ensure_my_profile();
reset role;
select tests.ok('ensure_my_profile is idempotent',
  (select count(*) = 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'));
select tests.logout();
select tests.throws('anon cannot call ensure_my_profile', $$select public.ensure_my_profile()$$, array['42501']);
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.throws('users cannot build profiles for arbitrary ids',
  $$select public.create_profile_for_auth_user('00000000-0000-0000-0000-0000000000f2')$$, array['42501']);
reset role;
select set_config('request.jwt.claims', '', true);
delete from auth.users where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
delete from public.analytics_events where user_id is null and event_name = 'account_created';

-- As alice
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.affects('user updates own name/bio',
  $$update public.profiles set name = 'Alice B.', bio = 'Junior, CS' where id = '00000000-0000-0000-0000-00000000000a'$$, 1);
select tests.throws('user cannot change own role',
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a'$$, array['42501']);
select tests.throws('user cannot self-verify',
  $$update public.profiles set provider_verified_at = now() where id = '00000000-0000-0000-0000-00000000000a'$$, array['42501']);
select tests.throws('user cannot un-suspend / change status',
  $$update public.profiles set account_status = 'active' where id = '00000000-0000-0000-0000-00000000000a'$$, array['42501']);
select tests.affects('user cannot edit someone else''s profile',
  $$update public.profiles set name = 'pwned' where id = '00000000-0000-0000-0000-00000000000b'$$, 0);
select tests.throws('users cannot insert profiles directly',
  $$insert into public.profiles (id) values (gen_random_uuid())$$, array['42501']);
select tests.throws('users cannot delete profiles',
  $$delete from public.profiles where id = '00000000-0000-0000-0000-00000000000a'$$, array['42501']);
select tests.affects('student preferences: create own',
  $$insert into public.student_profiles (user_id, budget_min, budget_max) values ('00000000-0000-0000-0000-00000000000a', 800, 1200)$$, 1);
select tests.throws('student preferences: budget range enforced',
  $$update public.student_profiles set budget_min = 2000 where user_id = '00000000-0000-0000-0000-00000000000a'$$, array['23514']);

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok('student preferences are private', (select count(*) = 0 from public.student_profiles));

select tests.logout();
select tests.ok('anon can read public profile info', (select count(*) = 5 from public.profiles));
select tests.throws('anon cannot read student preferences', $$select * from public.student_profiles$$, array['42501']);

-- ===========================================================================
-- Listings
-- ===========================================================================
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.affects('provider saves a partial draft',
  $$insert into public.listings (id, owner_id, title) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Sunny 2BR on the Hill')$$, 1);
select tests.throws('incomplete listing cannot be published',
  $$update public.listings set status = 'active' where id = '10000000-0000-0000-0000-000000000001'$$, array['23514']);
select tests.affects('complete listing publishes',
  $$update public.listings set
      description = 'Two bedrooms, walk to campus.', property_type = 'apartment', listing_type = 'lease',
      monthly_rent = 2400, bedrooms = 2, bathrooms = 1.5, available_date = '2027-08-01', lease_end_date = '2028-07-31',
      address = '1100 College Ave, Boulder, CO', neighborhood = 'University Hill',
      latitude = 40.0040, longitude = -105.2770, status = 'active'
    where id = '10000000-0000-0000-0000-000000000001'$$, 1);
select tests.ok('published_at stamped on publish',
  (select published_at is not null from public.listings where id = '10000000-0000-0000-0000-000000000001'));
select tests.ok('distance from campus computed (< 1 mi on the Hill)',
  (select distance_from_campus_mi between 0.1 and 1 from public.listings where id = '10000000-0000-0000-0000-000000000001'));
select tests.ok('full-text search vector matches neighborhood',
  (select search_vector @@ websearch_to_tsquery('english', 'hill') from public.listings where id = '10000000-0000-0000-0000-000000000001'));
select tests.throws('rent must be positive',
  $$update public.listings set monthly_rent = 0 where id = '10000000-0000-0000-0000-000000000001'$$, array['23514']);
select tests.throws('half-bath granularity enforced',
  $$update public.listings set bathrooms = 1.3 where id = '10000000-0000-0000-0000-000000000001'$$, array['23514']);
select tests.throws('lease end must follow move-in',
  $$update public.listings set lease_end_date = '2027-01-01' where id = '10000000-0000-0000-0000-000000000001'$$, array['23514']);
update public.listings set removed_at = now(), removal_reason = 'self' where id = '10000000-0000-0000-0000-000000000001';
select tests.ok('owner cannot write moderation fields',
  (select removed_at is null and removal_reason is null from public.listings where id = '10000000-0000-0000-0000-000000000001'));
select tests.throws('owner cannot mark own listing removed',
  $$update public.listings set status = 'removed' where id = '10000000-0000-0000-0000-000000000001'$$, array['42501', '23514']);
select tests.affects('second draft for deletion test',
  $$insert into public.listings (id, owner_id, title) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'Draft to delete')$$, 1);
select tests.affects('owner can delete a draft',
  $$delete from public.listings where id = '10000000-0000-0000-0000-000000000002'$$, 1);
select tests.affects('owner cannot delete a published listing',
  $$delete from public.listings where id = '10000000-0000-0000-0000-000000000001'$$, 0);
select tests.affects('another draft stays private',
  $$insert into public.listings (id, owner_id, title) values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'Private draft')$$, 1);

select tests.logout();
select tests.ok('anon sees active listings only',
  (select array_agg(id::text) = array['10000000-0000-0000-0000-000000000001'] from public.listings));
select tests.throws('anon cannot create listings',
  $$insert into public.listings (owner_id, title) values ('00000000-0000-0000-0000-00000000000b', 'anon listing')$$, array['42501']);

select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.throws('cannot create a listing as someone else',
  $$insert into public.listings (owner_id, title) values ('00000000-0000-0000-0000-00000000000b', 'Impersonated')$$, array['42501']);
select tests.affects('cannot edit someone else''s listing',
  $$update public.listings set monthly_rent = 1 where id = '10000000-0000-0000-0000-000000000001'$$, 0);
select tests.ok('cannot see someone else''s drafts',
  (select count(*) = 0 from public.listings where id = '10000000-0000-0000-0000-000000000003'));

select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.throws('suspended users cannot create listings',
  $$insert into public.listings (owner_id, title) values ('00000000-0000-0000-0000-00000000000e', 'Suspended listing')$$, array['42501']);

-- ===========================================================================
-- Listing images & storage
-- ===========================================================================
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.affects('owner adds image under own folder',
  $$insert into public.listing_images (listing_id, storage_path) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b/10000000-0000-0000-0000-000000000001/a.jpg')$$, 1);
select tests.throws('image path must be in owner''s folder',
  $$insert into public.listing_images (listing_id, storage_path) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a/x.jpg')$$, array['42501']);
select tests.affects('owner uploads to own storage folder',
  $$insert into storage.objects (bucket_id, name) values ('listing-images', '00000000-0000-0000-0000-00000000000b/10000000-0000-0000-0000-000000000001/a.jpg')$$, 1);
select tests.throws('cannot upload into another user''s folder',
  $$insert into storage.objects (bucket_id, name) values ('listing-images', '00000000-0000-0000-0000-00000000000a/evil.jpg')$$, array['42501']);

select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.throws('cannot add images to someone else''s listing',
  $$insert into public.listing_images (listing_id, storage_path) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a/y.jpg')$$, array['42501']);
select tests.affects('cannot delete someone else''s storage objects',
  $$delete from storage.objects where name like '00000000-0000-0000-0000-00000000000b/%'$$, 0);

select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.throws('suspended users cannot upload',
  $$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000e/me.jpg')$$, array['42501']);

select tests.logout();
select tests.ok('anon sees images of active listings', (select count(*) = 1 from public.listing_images));

-- ===========================================================================
-- Favorites
-- ===========================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.affects('save an active listing',
  $$insert into public.favorites (user_id, listing_id) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001')$$, 1);
select tests.throws('cannot save on someone else''s behalf',
  $$insert into public.favorites (user_id, listing_id) values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001')$$, array['42501']);
select tests.throws('cannot save a draft',
  $$insert into public.favorites (user_id, listing_id) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003')$$, array['42501']);
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok('favorites are private', (select count(*) = 0 from public.favorites));

-- ===========================================================================
-- Conversations & messages
-- ===========================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.affects('student contacts listing owner',
  $$insert into public.conversations (id, listing_id, student_id, owner_id) values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')$$, 1);
select tests.throws('owner_id must be the real listing owner',
  $$insert into public.conversations (listing_id, student_id, owner_id) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c')$$, array['42501', '23505']);
select tests.throws('one conversation per student per listing',
  $$insert into public.conversations (listing_id, student_id, owner_id) values
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')$$, array['23505']);
select tests.affects('student sends a message',
  $$insert into public.messages (conversation_id, sender_id, body) values
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Hey, is this still available?')$$, 1);
select tests.throws('empty messages rejected',
  $$insert into public.messages (conversation_id, sender_id, body) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '   ')$$, array['23514']);
select tests.throws('cannot send as someone else',
  $$insert into public.messages (conversation_id, sender_id, body) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'spoof')$$, array['42501']);
select tests.affects('sender cannot mark own message read',
  $$update public.messages set read_at = now()$$, 0);
select tests.throws('messages are immutable',
  $$update public.messages set body = 'edited'$$, array['42501']);

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok('owner sees the thread', (select count(*) = 1 from public.messages));
select tests.affects('recipient marks message read', $$update public.messages set read_at = now()$$, 1);
select tests.ok('conversation activity timestamp updated',
  (select last_message_at >= created_at from public.conversations where id = '20000000-0000-0000-0000-000000000001'));

select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.ok('outsiders cannot see conversations', (select count(*) = 0 from public.conversations));
select tests.ok('outsiders cannot see messages', (select count(*) = 0 from public.messages));
select tests.throws('outsiders cannot post into a thread',
  $$insert into public.messages (conversation_id, sender_id, body) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'hi')$$, array['42501']);

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.throws('owner cannot open a conversation with self',
  $$insert into public.conversations (listing_id, student_id, owner_id) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b')$$, array['23514', '42501']);

-- ===========================================================================
-- Roommate profiles
-- ===========================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.affects('create own roommate profile',
  $$insert into public.roommate_profiles (user_id, budget_min, budget_max, move_in_date, study_habits) values ('00000000-0000-0000-0000-00000000000a', 700, 1100, '2027-08-15', 'quiet')$$, 1);
select tests.throws('invalid lifestyle values rejected',
  $$update public.roommate_profiles set smoking = 'sometimes' where user_id = '00000000-0000-0000-0000-00000000000a'$$, array['23514']);
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok('signed-in users see active roommate profiles', (select count(*) = 1 from public.roommate_profiles));
select tests.affects('cannot edit another roommate profile', $$update public.roommate_profiles set bio = 'x'$$, 0);
select tests.login('00000000-0000-0000-0000-00000000000a');
update public.roommate_profiles set active = false;
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok('inactive roommate profiles hidden', (select count(*) = 0 from public.roommate_profiles));
select tests.logout();
select tests.throws('anon cannot browse roommates', $$select * from public.roommate_profiles$$, array['42501']);

-- ===========================================================================
-- Reports, moderation, audit log
-- ===========================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.affects('report a listing',
  $$insert into public.reports (reporter_id, listing_id, reason, description) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'scam', 'Asked for a wire transfer before a tour')$$, 1);
select tests.throws('duplicate open report blocked',
  $$insert into public.reports (reporter_id, listing_id, reason) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'scam')$$, array['23505']);
select tests.throws('reporter cannot pre-resolve a report',
  $$insert into public.reports (reporter_id, reported_user_id, reason, status) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'harassment', 'resolved')$$, array['42501']);
select tests.throws('cannot report yourself',
  $$insert into public.reports (reporter_id, reported_user_id, reason) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'other')$$, array['42501']);
select tests.throws('report needs a target',
  $$insert into public.reports (reporter_id, reason) values ('00000000-0000-0000-0000-00000000000a', 'other')$$, array['23514']);
select tests.affects('reporter cannot change report status', $$update public.reports set status = 'dismissed'$$, 0);
select tests.ok('audit log hidden from non-admins', (select count(*) = 0 from public.audit_log));
select tests.throws('audit log not writable by users',
  $$insert into public.audit_log (action, target_type, target_id) values ('x', 'user', gen_random_uuid())$$, array['42501']);

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok('reported party cannot see the report', (select count(*) = 0 from public.reports));

select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.ok('admin sees all reports', (select count(*) = 1 from public.reports));
select tests.affects('admin resolves a report',
  $$update public.reports set status = 'resolved', resolved_by = '00000000-0000-0000-0000-00000000000d', resolved_at = now()$$, 1);
select tests.ok('admin sees drafts for moderation', (select count(*) = 2 from public.listings));
select tests.affects('admin removes a listing',
  $$update public.listings set status = 'removed', removed_at = now(), removed_by = '00000000-0000-0000-0000-00000000000d', removal_reason = 'Scam report confirmed'
    where id = '10000000-0000-0000-0000-000000000001'$$, 1);

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok('owner still sees removed listing', (select status = 'removed' from public.listings where id = '10000000-0000-0000-0000-000000000001'));
select tests.affects('owner cannot reactivate a removed listing',
  $$update public.listings set status = 'active' where id = '10000000-0000-0000-0000-000000000001'$$, 0);
select tests.throws('owner cannot add images to a removed listing',
  $$insert into public.listing_images (listing_id, storage_path) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b/z.jpg')$$, array['42501']);

select tests.logout();
select tests.ok('removed listings hidden from the public', (select count(*) = 0 from public.listings));
select tests.ok('images of removed listings hidden', (select count(*) = 0 from public.listing_images));

-- ===========================================================================
-- Analytics
-- ===========================================================================
select tests.logout();
select tests.throws('no direct inserts into analytics', $$insert into public.analytics_events (event_name) values ('search_performed')$$, array['42501']);
select public.track_event('search_performed', null, '{"q":"hill"}');
select tests.throws('unknown event names rejected', $$select public.track_event('made_up_event')$$, array['23514']);

select tests.login('00000000-0000-0000-0000-00000000000a');
select public.track_event('listing_viewed', '10000000-0000-0000-0000-000000000001');
select tests.ok('users cannot read analytics', (select count(*) = 0 from public.analytics_events));

select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.ok('track_event stamps the caller (null for anon, self when signed in)',
  (select bool_and(case event_name when 'search_performed' then user_id is null
                                    when 'listing_viewed'   then user_id = '00000000-0000-0000-0000-00000000000a' end)
   from public.analytics_events where event_name in ('search_performed', 'listing_viewed')));

-- ===========================================================================
-- Every public table has RLS enabled
-- ===========================================================================
reset role;
select tests.ok('RLS enabled on every public table',
  not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity));

\o
\echo 'All RLS tests passed.'
rollback;
