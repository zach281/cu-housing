-- =============================================================================
-- Milestone 1 · Profiles, roles, verification, and auth sync
-- =============================================================================
-- Every account lives in Supabase's auth.users. public.profiles holds the
-- app-facing data. Users can edit their own name, bio and photo; role,
-- verification and suspension can only change through database triggers or
-- admin-only functions, never through a user's own client.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'provider', 'admin');

-- Ordered from weakest to strongest. Derived from timestamps below, so the
-- system can later add more evidence (documents, ID checks) without a rewrite.
create type public.verification_status as enum (
  'unverified',
  'cu_verified',
  'provider_verified',
  'admin_verified'
);

create type public.account_status as enum ('active', 'suspended');

-- ---------------------------------------------------------------------------
-- Campus constants (single place to change when adding universities)
-- ---------------------------------------------------------------------------
create or replace function public.is_cu_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Exact domain match only. Possession of this address proves CU affiliation,
  -- not that someone is a legitimate landlord.
  select coalesce(lower(split_part(email, '@', 2)) = 'colorado.edu', false)
$$;

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- Email is intentionally NOT copied here: profiles are publicly readable
-- (listing owners are shown on listings), and emails must not leak.
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  name                 text not null default '' check (char_length(name) <= 80),
  role                 public.user_role not null default 'student',
  profile_photo_path   text check (char_length(profile_photo_path) <= 512),
  bio                  text check (char_length(bio) <= 1000),

  -- Verification evidence. Status is derived, never written directly.
  cu_verified_at       timestamptz,
  provider_verified_at timestamptz,
  admin_verified_at    timestamptz,
  verification_status  public.verification_status generated always as (
    case
      when admin_verified_at    is not null then 'admin_verified'::public.verification_status
      when provider_verified_at is not null then 'provider_verified'::public.verification_status
      when cu_verified_at       is not null then 'cu_verified'::public.verification_status
      else 'unverified'::public.verification_status
    end
  ) stored,

  account_status       public.account_status not null default 'active',
  suspended_at         timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint profiles_suspension_consistent
    check ((account_status = 'suspended') = (suspended_at is not null))
);

create index profiles_role_idx on public.profiles (role);
create index profiles_created_at_idx on public.profiles (created_at desc);
-- Admin queue: providers waiting for verification.
create index profiles_pending_provider_idx on public.profiles (created_at)
  where role = 'provider' and provider_verified_at is null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so RLS policies can call them
-- without recursing into profiles' own policies)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and account_status = 'active'
  )
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and account_status = 'active'
  )
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_active_user() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_active_user() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auth → profile sync
-- ---------------------------------------------------------------------------
-- New auth user → profile. The client may express an intent to be a housing
-- provider at sign-up; it can never self-assign admin.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'intended_role';
begin
  insert into public.profiles (id, name, role, cu_verified_at)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 80),
    case when requested_role = 'provider' then 'provider'::public.user_role
         else 'student'::public.user_role end,
    case when new.email_confirmed_at is not null and public.is_cu_email(new.email)
         then new.email_confirmed_at end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Email confirmed or changed → recompute CU verification.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_cu boolean := new.email_confirmed_at is not null and public.is_cu_email(new.email);
begin
  update public.profiles p
  set cu_verified_at = case
        when not is_cu then null                                  -- moved off a CU address
        when p.cu_verified_at is not null then p.cu_verified_at   -- keep original date
        else new.email_confirmed_at
      end
  where p.id = new.id
    and (p.cu_verified_at is null) = is_cu;                      -- only when it changes
  return new;
end;
$$;

create trigger on_auth_user_email_change
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Public profile info (name, photo, verification badge) is shown on listings.
create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column-level guard: users may only touch these fields. Role, verification
-- and suspension are not updatable from the client at all.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (name, bio, profile_photo_path) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- student_profiles: private search preferences (owner + admins only)
-- ---------------------------------------------------------------------------
-- Lifestyle/roommate preferences live on roommate_profiles (one source of
-- truth for matching) rather than being duplicated here.
create table public.student_profiles (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  graduation_year    smallint check (graduation_year between 2000 and 2100),
  major              text check (char_length(major) <= 100),
  budget_min         integer check (budget_min >= 0),
  budget_max         integer check (budget_max >= 0),
  preferred_move_in  date,
  preferred_bedrooms smallint check (preferred_bedrooms between 0 and 10),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint student_profiles_budget_range check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create trigger student_profiles_set_updated_at
  before update on public.student_profiles
  for each row execute function public.set_updated_at();

alter table public.student_profiles enable row level security;

create policy "Students read own preferences"
  on public.student_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Students create own preferences"
  on public.student_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy "Students update own preferences"
  on public.student_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));

create policy "Students delete own preferences"
  on public.student_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.student_profiles from anon;
grant select, insert, update, delete on public.student_profiles to authenticated;
