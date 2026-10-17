-- =============================================================================
-- Milestone 2 · Listing limits and photo storage fixes
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Storage: owners can read their own objects.
-- Supabase Storage needs SELECT as well as DELETE permission to remove a file
-- (and SELECT + UPDATE to overwrite one). Without this, deleting a photo
-- silently removed nothing. Public listing photos are still served to everyone
-- through public URLs, which don't go through these policies.
-- ---------------------------------------------------------------------------
create policy "Users read their own images"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- At most 15 photos per listing.
-- ---------------------------------------------------------------------------
create or replace function public.listing_images_enforce_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Lock the parent listing so concurrent uploads can't both slip under the cap.
  perform 1 from public.listings where id = new.listing_id for update;
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 15 then
    raise exception 'too_many_photos: a listing can have at most 15 photos'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listing_images_enforce_limit
  before insert on public.listing_images
  for each row execute function public.listing_images_enforce_limit();

-- ---------------------------------------------------------------------------
-- Posting rate limit: at most 10 new listings per user per 24 hours.
-- Stops scripted spam; generous for real landlords. Admins are exempt.
-- PostgREST turns SQLSTATE PT429 into HTTP 429.
-- ---------------------------------------------------------------------------
create or replace function public.listings_enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if (
    select count(*) from public.listings
    where owner_id = new.owner_id and created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'listing_rate_limit: you can create up to 10 listings per day'
      using errcode = 'PT429';
  end if;
  return new;
end;
$$;

create trigger listings_enforce_rate_limit
  before insert on public.listings
  for each row execute function public.listings_enforce_rate_limit();

-- Supports the rate-limit check and "my listings" ordering.
create index if not exists listings_owner_created_idx on public.listings (owner_id, created_at desc);
