-- =============================================================================
-- Milestone 1 · Marketplace schema
-- listings, listing_images, favorites, conversations, messages,
-- roommate_profiles, reports, audit_log, analytics_events
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.listing_type as enum (
  'lease',           -- a whole unit on a new lease
  'room',            -- a room in a shared unit
  'sublease',        -- temporary, original tenant keeps the lease
  'lease_takeover'   -- the lease is transferred to the new tenant
);

create type public.property_type as enum (
  'apartment', 'house', 'townhouse', 'condo', 'duplex', 'studio', 'other'
);

create type public.listing_status as enum (
  'draft',        -- visible only to the owner
  'active',       -- public
  'unavailable',  -- owner marked rented/paused; visible to owner only
  'removed'       -- taken down by moderation; owner cannot edit or restore
);

create type public.report_reason as enum (
  'scam', 'inaccurate', 'unavailable', 'duplicate', 'offensive', 'harassment', 'other'
);

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- Distance from campus (Norlin Library, CU Boulder) in miles. Immutable so it
-- can back a stored generated column and an index for "within X miles".
-- ---------------------------------------------------------------------------
create or replace function public.miles_from_campus(lat numeric, lng numeric)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when lat is null or lng is null then null else
    round((3958.8 * 2 * asin(sqrt(
      power(sin(radians((lat - 40.00848) / 2)), 2)
      + cos(radians(40.00848)) * cos(radians(lat))
        * power(sin(radians((lng - (-105.27063)) / 2)), 2)
    )))::numeric, 2)
  end
$$;

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
-- Columns are nullable so drafts can be saved part-way; the
-- listings_publishable constraint enforces completeness once a listing
-- leaves draft.
create table public.listings (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles (id) on delete cascade,

  title               text check (char_length(title) between 5 and 120),
  description         text check (char_length(description) <= 5000),
  property_type       public.property_type,
  listing_type        public.listing_type,

  monthly_rent        integer check (monthly_rent between 1 and 20000),  -- whole USD
  bedrooms            smallint check (bedrooms between 0 and 10),        -- 0 = studio
  bathrooms           numeric(3,1) check (bathrooms between 0 and 10 and bathrooms * 2 = floor(bathrooms * 2)),

  available_date      date,
  lease_end_date      date,

  address             text check (char_length(address) <= 200),
  neighborhood        text check (char_length(neighborhood) <= 80),
  latitude            numeric(9,6) check (latitude between -90 and 90),
  longitude           numeric(9,6) check (longitude between -180 and 180),
  distance_from_campus_mi numeric generated always as (public.miles_from_campus(latitude, longitude)) stored,

  furnished           boolean not null default false,
  parking             boolean not null default false,
  pets_allowed        boolean not null default false,
  utilities_included  boolean not null default false,

  status              public.listing_status not null default 'draft',
  published_at        timestamptz,

  -- Moderation (admin-only; guarded by trigger below)
  removed_at          timestamptz,
  removed_by          uuid references public.profiles (id) on delete set null,
  removal_reason      text check (char_length(removal_reason) <= 1000),

  search_vector       tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(neighborhood, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(address, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint listings_lease_dates check (lease_end_date is null or available_date is null or lease_end_date > available_date),
  constraint listings_publishable check (
    status = 'draft' or (
      title is not null and description is not null and property_type is not null
      and listing_type is not null and monthly_rent is not null and bedrooms is not null
      and bathrooms is not null and available_date is not null and address is not null
      and latitude is not null and longitude is not null
    )
  ),
  constraint listings_removed_consistent check ((status = 'removed') = (removed_at is not null))
);

-- Browse/search: almost every query filters status = 'active', so partial
-- indexes keep them small and fast.
create index listings_owner_idx            on public.listings (owner_id, updated_at desc);
create index listings_active_rent_idx      on public.listings (monthly_rent)            where status = 'active';
create index listings_active_available_idx on public.listings (available_date)          where status = 'active';
create index listings_active_beds_idx      on public.listings (bedrooms, bathrooms)     where status = 'active';
create index listings_active_type_idx      on public.listings (listing_type, property_type) where status = 'active';
create index listings_active_distance_idx  on public.listings (distance_from_campus_mi)  where status = 'active';
create index listings_active_published_idx on public.listings (published_at desc)       where status = 'active';
create index listings_search_idx           on public.listings using gin (search_vector);
create index listings_created_at_idx       on public.listings (created_at desc);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- Guard: owners can't touch moderation fields, and published_at is stamped
-- by the database the first time a listing goes active.
create or replace function public.listings_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.status = 'removed' then
        raise exception 'Only admins can remove listings' using errcode = '42501';
      end if;
      new.removed_at := null; new.removed_by := null; new.removal_reason := null;
      new.published_at := null;
    else
      if new.status = 'removed' or old.status = 'removed' then
        raise exception 'Only admins can change removed listings' using errcode = '42501';
      end if;
      if new.owner_id <> old.owner_id then
        raise exception 'Listing owner cannot be changed' using errcode = '42501';
      end if;
      new.removed_at := old.removed_at; new.removed_by := old.removed_by;
      new.removal_reason := old.removal_reason;
      new.published_at := old.published_at;
    end if;
  end if;

  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger listings_guard
  before insert or update on public.listings
  for each row execute function public.listings_guard();

alter table public.listings enable row level security;

create policy "Active listings are public; owners and admins see all of theirs"
  on public.listings for select to anon, authenticated
  using (
    status = 'active'
    or owner_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "Active users create their own listings"
  on public.listings for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_active_user()));

create policy "Owners update their own non-removed listings"
  on public.listings for update to authenticated
  using (owner_id = (select auth.uid()) and status <> 'removed')
  with check (owner_id = (select auth.uid()) and status <> 'removed' and (select public.is_active_user()));

create policy "Admins moderate listings"
  on public.listings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Only drafts can be deleted; published listings are marked unavailable so
-- conversations and reports keep their context.
create policy "Owners delete their own drafts"
  on public.listings for delete to authenticated
  using (owner_id = (select auth.uid()) and status = 'draft');

revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;

-- ---------------------------------------------------------------------------
-- listing_images
-- ---------------------------------------------------------------------------
create table public.listing_images (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  storage_path  text not null unique check (char_length(storage_path) <= 512),
  display_order smallint not null default 0 check (display_order between 0 and 49),
  created_at    timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id, display_order);

alter table public.listing_images enable row level security;

-- Visible whenever the parent listing is visible (listings RLS applies inside).
create policy "Images follow listing visibility"
  on public.listing_images for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "Owners manage images on their listings"
  on public.listing_images for all to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = (select auth.uid()) and l.status <> 'removed'
  ))
  with check (
    (select public.is_active_user())
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid()) and l.status <> 'removed'
    )
    -- Files must live under the uploader's own storage folder.
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

revoke all on public.listing_images from anon, authenticated;
grant select on public.listing_images to anon, authenticated;
grant insert, update, delete on public.listing_images to authenticated;

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favorites_listing_idx on public.favorites (listing_id);
create index favorites_user_recent_idx on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

create policy "Users read their own favorites"
  on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users save visible listings"
  on public.favorites for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_id and l.status = 'active')
  );

create policy "Users remove their own favorites"
  on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

-- ---------------------------------------------------------------------------
-- conversations + messages
-- ---------------------------------------------------------------------------
-- One thread per (listing, student). Creating a conversation is the
-- "housing connection" — the marketplace's north-star metric.
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references public.listings (id) on delete set null,
  student_id      uuid not null references public.profiles (id) on delete cascade,
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conversations_distinct_parties check (student_id <> owner_id),
  constraint conversations_one_per_listing unique (listing_id, student_id)
);

create index conversations_student_idx on public.conversations (student_id, last_message_at desc);
create index conversations_owner_idx   on public.conversations (owner_id, last_message_at desc);
create index conversations_created_idx on public.conversations (created_at desc);

alter table public.conversations enable row level security;

create policy "Participants read conversations"
  on public.conversations for select to authenticated
  using (
    student_id = (select auth.uid()) or owner_id = (select auth.uid())
    or (select public.is_admin())
  );

-- A student opens a thread on an active listing; owner_id must be the real
-- listing owner (checked here, not trusted from the client).
create policy "Students start conversations on active listings"
  on public.conversations for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select public.is_active_user())
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'active' and l.owner_id = conversations.owner_id
    )
  );

revoke all on public.conversations from anon, authenticated;
grant select, insert on public.conversations to authenticated;

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;

alter table public.messages enable row level security;

create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv_id
      and (select auth.uid()) in (c.student_id, c.owner_id)
  )
$$;
revoke all on function public.is_conversation_participant(uuid) from public;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

create policy "Participants read messages"
  on public.messages for select to authenticated
  using ((select public.is_conversation_participant(conversation_id)) or (select public.is_admin()));

create policy "Participants send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select public.is_active_user())
    and (select public.is_conversation_participant(conversation_id))
    and read_at is null
  );

-- Recipients mark messages read. Column grant limits updates to read_at.
create policy "Recipients mark messages read"
  on public.messages for update to authenticated
  using (sender_id <> (select auth.uid()) and (select public.is_conversation_participant(conversation_id)))
  with check (sender_id <> (select auth.uid()) and (select public.is_conversation_participant(conversation_id)));

revoke all on public.messages from anon, authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Keep conversations sorted by latest activity.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------------------------------------------------------------------------
-- roommate_profiles
-- ---------------------------------------------------------------------------
-- Typed lifestyle columns (not free-form JSON) so matching in Milestone 6 can
-- rely on valid values; `extra_preferences` leaves room to grow.
create table public.roommate_profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references public.profiles (id) on delete cascade,
  budget_min         integer not null check (budget_min >= 0),
  budget_max         integer not null check (budget_max >= 0),
  move_in_date       date not null,
  preferred_bedrooms smallint check (preferred_bedrooms between 0 and 10),
  smoking            text not null default 'no' check (smoking in ('no', 'outside_only', 'yes')),
  has_pets           boolean not null default false,
  ok_with_pets       boolean not null default true,
  study_habits       text not null default 'flexible' check (study_habits in ('quiet', 'flexible', 'social')),
  social_level       text not null default 'balanced' check (social_level in ('low_key', 'balanced', 'very_social')),
  sleep_schedule     text not null default 'flexible' check (sleep_schedule in ('early', 'flexible', 'late')),
  cleanliness        smallint not null default 3 check (cleanliness between 1 and 5),
  extra_preferences  jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_preferences) = 'object'),
  bio                text check (char_length(bio) <= 1000),
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint roommate_profiles_budget_range check (budget_min <= budget_max)
);

create index roommate_profiles_active_idx on public.roommate_profiles (move_in_date, budget_min, budget_max) where active;

create trigger roommate_profiles_set_updated_at
  before update on public.roommate_profiles
  for each row execute function public.set_updated_at();

alter table public.roommate_profiles enable row level security;

-- Only signed-in users can browse roommates; never anonymous.
create policy "Signed-in users see active roommate profiles"
  on public.roommate_profiles for select to authenticated
  using (active or user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users create their own roommate profile"
  on public.roommate_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy "Users update their own roommate profile"
  on public.roommate_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy "Users delete their own roommate profile"
  on public.roommate_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.roommate_profiles from anon, authenticated;
grant select, insert, update, delete on public.roommate_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- reports (listing and/or user)
-- ---------------------------------------------------------------------------
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid references public.profiles (id) on delete set null,
  listing_id       uuid references public.listings (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  reason           public.report_reason not null,
  description      text check (char_length(description) <= 2000),
  status           public.report_status not null default 'open',
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolved_at      timestamptz,
  resolution_note  text check (char_length(resolution_note) <= 2000),
  created_at       timestamptz not null default now(),
  constraint reports_has_target check (listing_id is not null or reported_user_id is not null)
);

create index reports_queue_idx   on public.reports (status, created_at desc);
create index reports_listing_idx on public.reports (listing_id);
create index reports_user_idx    on public.reports (reported_user_id);
-- One open report per reporter per target (stops spam / double-submits).
create unique index reports_one_open_per_listing on public.reports (reporter_id, listing_id)
  where status in ('open', 'reviewing') and listing_id is not null;
create unique index reports_one_open_per_user on public.reports (reporter_id, reported_user_id)
  where status in ('open', 'reviewing') and listing_id is null;

alter table public.reports enable row level security;

create policy "Users file reports"
  on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open' and resolved_by is null and resolved_at is null and resolution_note is null
    and (reported_user_id is null or reported_user_id <> (select auth.uid()))
  );

create policy "Users see their own reports; admins see all"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins review reports"
  on public.reports for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.reports from anon, authenticated;
grant select, insert, update on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- audit_log (append-only; written by admin-only functions)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (char_length(action) <= 64),
  target_type text not null check (target_type in ('listing', 'user', 'report')),
  target_id   uuid not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_target_idx on public.audit_log (target_type, target_id, created_at desc);
create index audit_log_recent_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "Admins read the audit log"
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- analytics_events
-- ---------------------------------------------------------------------------
-- Written only through track_event(), which stamps the caller's identity so
-- events can't be attributed to someone else.
create table public.analytics_events (
  id          bigint generated always as identity primary key,
  event_name  text not null check (event_name in (
                'account_created', 'listing_viewed', 'listing_saved', 'listing_contacted',
                'listing_created', 'search_performed', 'roommate_profile_created'
              )),
  user_id     uuid references public.profiles (id) on delete set null,
  listing_id  uuid references public.listings (id) on delete set null,
  properties  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index analytics_events_name_time_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_listing_idx on public.analytics_events (listing_id, event_name) where listing_id is not null;

alter table public.analytics_events enable row level security;

create policy "Admins read analytics"
  on public.analytics_events for select to authenticated
  using ((select public.is_admin()));

revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;

create or replace function public.track_event(
  p_event_name text,
  p_listing_id uuid default null,
  p_properties jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_column_size(p_properties) > 2048 then
    raise exception 'Event properties too large' using errcode = '22023';
  end if;
  insert into public.analytics_events (event_name, user_id, listing_id, properties)
  values (p_event_name, (select auth.uid()), p_listing_id, coalesce(p_properties, '{}'::jsonb));
end;
$$;

revoke all on function public.track_event(text, uuid, jsonb) from public;
grant execute on function public.track_event(text, uuid, jsonb) to anon, authenticated;

-- account_created is recorded by the database itself, so it can't be missed.
create or replace function public.profiles_track_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (event_name, user_id, properties)
  values ('account_created', new.id, jsonb_build_object('role', new.role));
  return new;
end;
$$;

create trigger profiles_track_created
  after insert on public.profiles
  for each row execute function public.profiles_track_created();
