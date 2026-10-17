import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listingImageUrl, thumbPathFor } from "./images";
import type { Tables } from "@/lib/supabase/database.types";

export type OwnListing = Tables<"listings"> & { images: ListingImage[] };
export type ListingImage = Pick<Tables<"listing_images">, "id" | "storage_path" | "display_order"> & {
  url: string;
  thumbUrl: string;
};

const LISTING_COLUMNS = "*, listing_images(id, storage_path, display_order)";

type Row = Tables<"listings"> & {
  listing_images: Pick<Tables<"listing_images">, "id" | "storage_path" | "display_order">[];
};

function withImages(row: Row): OwnListing {
  const { listing_images, ...listing } = row;
  const images = [...(listing_images ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map((img) => ({ ...img, url: listingImageUrl(img.storage_path), thumbUrl: listingImageUrl(thumbPathFor(img.storage_path)) }));
  return { ...listing, images };
}

/** One of the signed-in user's listings, or null (RLS and owner check). */
export async function getOwnListing(ownerId: string, id: string): Promise<OwnListing | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data ? withImages(data as Row) : null;
}

export async function getOwnListings(ownerId: string): Promise<OwnListing[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  return ((data ?? []) as Row[]).map(withImages);
}
