"use server";

import { createClient } from "@/lib/supabase/server";
import { parseFilters, searchAnalytics } from "@/lib/listings/search";

/** Logs search_performed. Takes the query string so the client can't send arbitrary properties. */
export async function trackSearch(queryString: string): Promise<void> {
  if (typeof queryString !== "string" || queryString.length > 1000) return;
  const filters = parseFilters(Object.fromEntries(new URLSearchParams(queryString)));
  const supabase = await createClient();
  const { error } = await supabase.rpc("track_event", {
    p_event_name: "search_performed",
    p_properties: searchAnalytics(filters),
  });
  if (error) console.error("track_event search_performed failed", error);
}
