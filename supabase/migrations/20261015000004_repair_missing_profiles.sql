-- =============================================================================
-- Repair accounts that have no profile row
-- -----------------------------------------------------------------------------
-- Profiles are created by the on_auth_user_created trigger. Accounts created
-- before that trigger existed (e.g. sign-ups made before the first migration
-- was run) have no profile, and the app treats them as signed out.
--   1. Backfill: create the missing profiles now.
--   2. ensure_my_profile(): lets the app self-heal any future case, for the
--      signed-in user only.
-- =============================================================================

-- Single source of truth for building a profile from an auth user.
create or replace function public.create_profile_for_auth_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, role, cu_verified_at)
  select
    u.id,
    left(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), 80),
    case when u.raw_user_meta_data ->> 'intended_role' = 'provider'
         then 'provider'::public.user_role else 'student'::public.user_role end,
    case when u.email_confirmed_at is not null and public.is_cu_email(u.email)
         then u.email_confirmed_at end
  from auth.users u
  where u.id = uid
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.create_profile_for_auth_user(uuid) from public, anon, authenticated;

-- The sign-up trigger now uses the same builder.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_profile_for_auth_user(new.id);
  return new;
end;
$$;

-- Callable by a signed-in user; only ever affects their own account.
-- Returns the (possibly just-created) profile so the caller needn't re-read it.
create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  result public.profiles;
begin
  if uid is null then
    return null;
  end if;
  perform public.create_profile_for_auth_user(uid);
  select * into result from public.profiles where id = uid;
  return result;
end;
$$;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- Backfill existing accounts.
select public.create_profile_for_auth_user(u.id)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
