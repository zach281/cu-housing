-- =============================================================================
-- Milestone 3 · Location privacy for public browsing, search tuning
-- -----------------------------------------------------------------------------
-- Browse is public. Posters are often students listing where they live, so
-- signed-out visitors get an approximate location only:
--   * approx_latitude / approx_longitude: coordinates snapped to a ~250 m grid
--     (enough for a map pin and "near campus", not enough to find the door)
--   * no street address, no exact coordinates
-- Signed-in users keep full access (shown on listing pages in Milestone 4).
-- Enforced with column privileges, so the API refuses the columns outright.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Approximate coordinates
-- ---------------------------------------------------------------------------
alter table public.listings
  add column approx_latitude  numeric(9,4) generated always as (round(latitude  / 0.0025) * 0.0025) stored,
  add column approx_longitude numeric(9,4) generated always as (round(longitude / 0.0025) * 0.0025) stored;

-- ---------------------------------------------------------------------------
-- Search: drop the street address from the full-text index, so searching
-- can't be used to confirm where someone lives. Title, neighborhood and
-- description remain searchable.
-- ---------------------------------------------------------------------------
drop index if exists public.listings_search_idx;
alter table public.listings drop column search_vector;
alter table public.listings add column search_vector tsvector generated always as (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(neighborhood, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'C')
) stored;
create index listings_search_idx on public.listings using gin (search_vector);

-- Common browse filters combined with the default sort.
create index if not exists listings_active_rent_published_idx
  on public.listings (monthly_rent, published_at desc) where status = 'active';

-- ---------------------------------------------------------------------------
-- Column privileges for signed-out visitors.
-- NOTE: new listings columns are NOT visible to anon until added here.
-- ---------------------------------------------------------------------------
revoke select on public.listings from anon;
grant select (
  id, owner_id, title, description, property_type, listing_type,
  monthly_rent, bedrooms, bathrooms, available_date, lease_end_date,
  neighborhood, approx_latitude, approx_longitude, distance_from_campus_mi,
  furnished, parking, pets_allowed, utilities_included,
  status, published_at, search_vector, created_at, updated_at
) on public.listings to anon;
-- Excluded for anon: address, latitude, longitude, removed_at, removed_by, removal_reason.
