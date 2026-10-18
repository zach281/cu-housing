-- =============================================================================
-- Local test stack bootstrap (DEVELOPMENT/TEST ONLY).
-- Recreates the roles and schemas a Supabase project provides, so the real
-- Supabase Auth server, PostgREST, and our migrations run unmodified.
-- Storage is emulated by e2e/stack/gateway.mjs on top of storage.objects RLS.
-- =============================================================================

do $$
declare r record;
begin
  for r in select * from (values
      ('anon', 'nologin noinherit'),
      ('authenticated', 'nologin noinherit'),
      ('service_role', 'nologin noinherit bypassrls'),
      ('authenticator', 'login noinherit'),
      ('supabase_auth_admin', 'login createrole noinherit')
    ) as v(name, opts)
  loop
    if not exists (select 1 from pg_roles where rolname = r.name) then
      execute format('create role %I %s', r.name, r.opts);
    end if;
  end loop;
end $$;

grant anon, authenticated, service_role to authenticator;

-- Auth server owns its schema and creates its tables on startup (`auth migrate`).
create schema if not exists auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
grant create on database stack to supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;

-- Supabase grants everything on new public objects to these roles by default;
-- migrations must revoke explicitly, so reproduce that.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Storage schema (what our migrations and policies reference).
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
grant select on storage.buckets to anon, authenticated, service_role;

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;

create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- Supabase installs extensions like pgcrypto in an "extensions" schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
