import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import { listingImageUrl, thumbPathFor } from "./images";
import { PAGE_SIZE, type Filters } from "./search";

// Only columns signed-out visitors may read (see migration 6). Exact address
// and coordinates are deliberately absent so the same query works for everyone.
const CARD_COLUMNS = `
  id, title, listing_type, property_type, monthly_rent, bedrooms, bathrooms,
  available_date, lease_end_date, neighborhood, approx_latitude, approx_longitude,
  distance_from_campus_mi, furnished, parking, pets_allowed, utilities_included, published_at,
  owner:profiles!listings_owner_id_fkey(verification_status),
  listing_images(storage_path, display_order)
`;

export type ListingCardData = {
  id: string;
  title: string;
  listingType: Enums<"listing_type">;
  propertyType: Enums<"property_type">;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  availableDate: string;
  leaseEndDate: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  miles: number | null;
  furnished: boolean;
  parking: boolean;
  pets: boolean;
  utilitiesIncluded: boolean;
  verification: Enums<"verification_status">;
  photo: { url: string; thumbUrl: string } | null;
};

export type SearchResult = { listings: ListingCardData[]; total: number; failed: boolean };

type Row = {
  id: string;
  title: string | null;
  listing_type: Enums<"listing_type"> | null;
  property_type: Enums<"property_type"> | null;
  monthly_rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  available_date: string | null;
  lease_end_date: string | null;
  neighborhood: string | null;
  approx_latitude: number | null;
  approx_longitude: number | null;
  distance_from_campus_mi: number | null;
  furnished: boolean;
  parking: boolean;
  pets_allowed: boolean;
  utilities_included: boolean;
  owner: { verification_status: Enums<"verification_status"> | null } | null;
  listing_images: { storage_path: string; display_order: number }[] | null;
};

function toCard(r: Row): ListingCardData {
  // Active listings always have these (listings_publishable constraint).
  const cover = [...(r.listing_images ?? [])].sort((a, b) => a.display_order - b.display_order)[0];
  return {
    id: r.id,
    title: r.title ?? "",
    listingType: r.listing_type!,
    propertyType: r.property_type!,
    rent: r.monthly_rent!,
    bedrooms: r.bedrooms!,
    bathrooms: Number(r.bathrooms),
    availableDate: r.available_date!,
    leaseEndDate: r.lease_end_date,
    neighborhood: r.neighborhood,
    lat: r.approx_latitude === null ? null : Number(r.approx_latitude),
    lng: r.approx_longitude === null ? null : Number(r.approx_longitude),
    miles: r.distance_from_campus_mi === null ? null : Number(r.distance_from_campus_mi),
    furnished: r.furnished,
    parking: r.parking,
    pets: r.pets_allowed,
    utilitiesIncluded: r.utilities_included,
    verification: r.owner?.verification_status ?? "unverified",
    photo: cover ? { url: listingImageUrl(cover.storage_path), thumbUrl: listingImageUrl(thumbPathFor(cover.storage_path)) } : null,
  };
}

/**
 * Adds the WHERE clauses for a set of filters. Generic over the builder so it
 * can be unit-tested with a recording fake; returns the same builder type.
 */
export function applyFilters<Q>(query: Q, f: Filters): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  q = q.eq("status", "active");
  if (f.q) q = q.textSearch("search_vector", f.q, { type: "websearch", config: "english" });
  if (f.minPrice !== null) q = q.gte("monthly_rent", f.minPrice);
  if (f.maxPrice !== null) q = q.lte("monthly_rent", f.maxPrice);
  if (f.bedsMin !== null) q = q.gte("bedrooms", f.bedsMin);
  if (f.bedsMax !== null) q = q.lte("bedrooms", f.bedsMax);
  if (f.bathsMin !== null) q = q.gte("bathrooms", f.bathsMin);
  if (f.moveIn) {
    // Can move in by that date, and the place is still available on it.
    q = q.lte("available_date", f.moveIn).or(`lease_end_date.is.null,lease_end_date.gt.${f.moveIn}`);
  }
  if (f.types.length) q = q.in("listing_type", f.types);
  if (f.properties.length) q = q.in("property_type", f.properties);
  if (f.furnished) q = q.eq("furnished", true);
  if (f.parking) q = q.eq("parking", true);
  if (f.pets) q = q.eq("pets_allowed", true);
  if (f.within !== null) q = q.lte("distance_from_campus_mi", f.within);
  return q as Q;
}

export async function searchListings(f: Filters, { mapView = false } = {}): Promise<SearchResult> {
  const supabase = await createClient();
  let query = applyFilters(
    supabase
      .from("listings")
      .select(CARD_COLUMNS, { count: "exact" })
      .order("display_order", { referencedTable: "listing_images", ascending: true })
      .limit(1, { referencedTable: "listing_images" }),
    f,
  );

  switch (f.sort) {
    case "price_asc":
      query = query.order("monthly_rent", { ascending: true }).order("published_at", { ascending: false });
      break;
    case "price_desc":
      query = query.order("monthly_rent", { ascending: false }).order("published_at", { ascending: false });
      break;
    case "distance":
      query = query.order("distance_from_campus_mi", { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order("published_at", { ascending: false });
  }
  query = query.order("id"); // stable pages

  // The map shows every match (up to a cap); the list is paginated.
  const from = mapView ? 0 : (f.page - 1) * PAGE_SIZE;
  const to = mapView ? 499 : from + PAGE_SIZE - 1;
  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("Listing search failed", error);
    return { listings: [], total: 0, failed: true };
  }
  return { listings: ((data ?? []) as unknown as Row[]).map(toCard), total: count ?? 0, failed: false };
}
