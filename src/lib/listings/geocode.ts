import "server-only";
import { CAMPUS, MAX_MILES_FROM_CAMPUS, milesBetween } from "./constants";
import { getSiteUrl } from "@/lib/site-url";

// Free address lookup, no accounts or keys:
//   1. U.S. Census Bureau geocoder (accurate for U.S. street addresses)
//      https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
//   2. OpenStreetMap Nominatim as a fallback when Census has no match or is
//      unreachable. Usage policy: identify the app, at most ~1 request/second,
//      no autocomplete. One lookup per button click stays well within it.
//      https://operations.osmfoundation.org/policies/nominatim/
// Posters can always drag the pin. Swap in Mapbox later by replacing geocode().

const CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; matchedAddress: string; miles: number; source: "census" | "osm" }
  | { ok: false; reason: "not_found" | "too_far" | "unavailable"; miles?: number };

type Hit = { lat: number; lng: number; matchedAddress: string };
type Lookup = Hit | "no_match" | "unavailable";

/** Adds "Boulder, CO" when the poster typed only a street address. */
export function withDefaultCity(address: string): string {
  const a = address.trim();
  return /\b(CO|Colorado)\b|\b8\d{4}\b/i.test(a) ? a : `${a}, Boulder, CO`;
}

/** Geocoders match buildings, not units: drop "Apt 3", "Unit B", "#204", "Ste 1". */
export function stripUnit(address: string): string {
  return address
    .replace(/[\s,]*(?:\b(?:apt|apartment|unit|ste|suite|rm|room|bldg|building|fl|floor)\.?|#)\s*[a-z0-9-]+\b/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type CensusResponse = {
  result?: { addressMatches?: { matchedAddress?: string; coordinates?: { x?: number; y?: number } }[] };
};

export function parseCensusResponse(body: unknown): Hit | null {
  const match = (body as CensusResponse)?.result?.addressMatches?.[0];
  const lng = match?.coordinates?.x;
  const lat = match?.coordinates?.y;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, matchedAddress: match?.matchedAddress ?? "" };
}

export function parseNominatimResponse(body: unknown): Hit | null {
  const first = Array.isArray(body) ? (body[0] as { lat?: string; lon?: string; display_name?: string }) : null;
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!first || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, matchedAddress: first.display_name ?? "" };
}

async function getJson(url: URL, fetchImpl: typeof fetch, headers: Record<string, string> = {}): Promise<unknown | "unavailable"> {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(7000), headers: { accept: "application/json", ...headers } });
    if (!res.ok) {
      console.error(`Geocoder ${url.hostname} returned HTTP ${res.status}`);
      return "unavailable";
    }
    return await res.json();
  } catch (e) {
    console.error(`Geocoder ${url.hostname} failed:`, e instanceof Error ? e.message : e);
    return "unavailable";
  }
}

async function census(query: string, fetchImpl: typeof fetch): Promise<Lookup> {
  const url = new URL(CENSUS);
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  const body = await getJson(url, fetchImpl);
  if (body === "unavailable") return "unavailable";
  return parseCensusResponse(body) ?? "no_match";
}

async function nominatim(query: string, fetchImpl: typeof fetch): Promise<Lookup> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  // Prefer results around Boulder County (not a hard limit).
  url.searchParams.set("viewbox", "-105.70,40.27,-104.95,39.85");
  const body = await getJson(url, fetchImpl, { "user-agent": `CampusNest/1.0 (+${getSiteUrl()})` });
  if (body === "unavailable") return "unavailable";
  return parseNominatimResponse(body) ?? "no_match";
}

export async function geocode(address: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeResult> {
  const query = withDefaultCity(stripUnit(address));

  let hit: Hit | null = null;
  let source: "census" | "osm" = "census";
  const first = await census(query, fetchImpl);
  if (typeof first === "object") hit = first;
  let second: Lookup | null = null;
  if (!hit) {
    second = await nominatim(query, fetchImpl);
    if (typeof second === "object") {
      hit = second;
      source = "osm";
    }
  }

  if (!hit) {
    const reason = first === "unavailable" && second === "unavailable" ? "unavailable" : "not_found";
    console.warn(`Address lookup ${reason} (census: ${first}, osm: ${second})`);
    return { ok: false, reason };
  }

  const miles = milesBetween(CAMPUS, hit);
  if (miles > MAX_MILES_FROM_CAMPUS) return { ok: false, reason: "too_far", miles };
  return { ok: true, ...hit, miles, source };
}
