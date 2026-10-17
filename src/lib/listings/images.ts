import { env } from "@/lib/env";

// Shared by server and browser code.

/** Public URL for a file in the public listing-images bucket. */
export function listingImageUrl(path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/listing-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Each photo has a small thumbnail stored next to it as <name>-thumb.<ext>. */
export function thumbPathFor(path: string): string {
  return path.replace(/(\.[a-z0-9]+)$/i, "-thumb$1");
}
