import "server-only";
import { CAMPUS, MAX_MILES_FROM_CAMPUS, milesBetween } from "./constants";

// U.S. Census Bureau geocoder: free, no account or key.
// https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
// It covers U.S. street addresses only, with no autocomplete; posters can
// drag the pin to correct it. Swap for Mapbox later by replacing geocode().

const ENDPOINT = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; matchedAddress: string; miles: number }
  | { ok: false; reason: "not_found" | "too_far" | "unavailable"; miles?: number };

/** Adds "Boulder, CO" when the poster typed only a street address. */
export function withDefaultCity(address: string): string {
  const a = address.trim();
  return /\b(CO|Colorado)\b|\b8\d{4}\b/i.test(a) ? a : `${a}, Boulder, CO`;
}

type CensusResponse = {
  result?: {
    addressMatches?: { matchedAddress?: string; coordinates?: { x?: number; y?: number } }[];
  };
};

export function parseCensusResponse(body: unknown): { lat: number; lng: number; matchedAddress: string } | null {
  const match = (body as CensusResponse)?.result?.addressMatches?.[0];
  const lng = match?.coordinates?.x;
  const lat = match?.coordinates?.y;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, matchedAddress: match?.matchedAddress ?? "" };
}

export async function geocode(address: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeResult> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("address", withDefaultCity(address));
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  let body: unknown;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    body = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const hit = parseCensusResponse(body);
  if (!hit) return { ok: false, reason: "not_found" };

  const miles = milesBetween(CAMPUS, hit);
  if (miles > MAX_MILES_FROM_CAMPUS) return { ok: false, reason: "too_far", miles };
  return { ok: true, ...hit, miles };
}
