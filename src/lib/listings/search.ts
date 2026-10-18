import { LISTING_TYPES, PROPERTY_TYPES, type ListingType, type PropertyType } from "./constants";

// Browse filters live in the URL, so searches are shareable and the back
// button works. This module is shared by the server (to query) and the filter
// UI (to build URLs); anything invalid in the URL is ignored, never an error.

export const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "distance", label: "Closest to campus" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

export const DISTANCES = [0.5, 1, 2, 3, 5, 10] as const;
export const PAGE_SIZE = 24;

export type Filters = {
  q: string;
  minPrice: number | null;
  maxPrice: number | null;
  bedsMin: number | null; // 0 = studio
  bedsMax: number | null;
  bathsMin: number | null;
  moveIn: string | null; // YYYY-MM-DD: available on or before this date
  types: ListingType[];
  properties: PropertyType[];
  furnished: boolean;
  parking: boolean;
  pets: boolean;
  within: number | null; // miles from campus
  sort: Sort;
  view: "list" | "map";
  page: number;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  minPrice: null,
  maxPrice: null,
  bedsMin: null,
  bedsMax: null,
  bathsMin: null,
  moveIn: null,
  types: [],
  properties: [],
  furnished: false,
  parking: false,
  pets: false,
  within: null,
  sort: "newest",
  view: "list",
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

function int(v: string | string[] | undefined, min: number, max: number): number | null {
  const s = first(v).replace(/[$,]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
}

function num(v: string | string[] | undefined, allowed: readonly number[]): number | null {
  const n = Number(first(v));
  return allowed.includes(n) ? n : null;
}

function list<T extends string>(v: string | string[] | undefined, allowed: readonly T[]): T[] {
  const raw = (Array.isArray(v) ? v : [v ?? ""]).flatMap((s) => s.split(","));
  return [...new Set(raw.map((s) => s.trim()).filter((s): s is T => (allowed as readonly string[]).includes(s)))];
}

const flag = (v: string | string[] | undefined) => ["1", "true", "on"].includes(first(v));

export function parseFilters(params: RawParams): Filters {
  let minPrice = int(params.min_price, 0, 20000);
  let maxPrice = int(params.max_price, 0, 20000);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  let bedsMin = int(params.beds_min, 0, 10);
  let bedsMax = int(params.beds_max, 0, 10);
  if (bedsMin !== null && bedsMax !== null && bedsMin > bedsMax) [bedsMin, bedsMax] = [bedsMax, bedsMin];
  const moveIn = /^\d{4}-\d{2}-\d{2}$/.test(first(params.move_in)) && !Number.isNaN(Date.parse(first(params.move_in)))
    ? first(params.move_in)
    : null;
  const sort = SORTS.some((s) => s.value === first(params.sort)) ? (first(params.sort) as Sort) : "newest";

  return {
    q: first(params.q).slice(0, 100),
    minPrice,
    maxPrice,
    bedsMin,
    bedsMax,
    bathsMin: num(params.baths_min, [1, 1.5, 2, 3]),
    moveIn,
    types: list(params.type, LISTING_TYPES.map((t) => t.value)),
    properties: list(params.property, PROPERTY_TYPES.map((t) => t.value)),
    furnished: flag(params.furnished),
    parking: flag(params.parking),
    pets: flag(params.pets),
    within: num(params.within, DISTANCES),
    sort,
    view: first(params.view) === "map" ? "map" : "list",
    page: int(params.page, 1, 1000) ?? 1,
  };
}

/** Canonical query string: only non-default values, stable order. */
export function toSearchParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.minPrice !== null) p.set("min_price", String(f.minPrice));
  if (f.maxPrice !== null) p.set("max_price", String(f.maxPrice));
  if (f.bedsMin !== null) p.set("beds_min", String(f.bedsMin));
  if (f.bedsMax !== null) p.set("beds_max", String(f.bedsMax));
  if (f.bathsMin !== null) p.set("baths_min", String(f.bathsMin));
  if (f.moveIn) p.set("move_in", f.moveIn);
  if (f.types.length) p.set("type", f.types.join(","));
  if (f.properties.length) p.set("property", f.properties.join(","));
  if (f.furnished) p.set("furnished", "1");
  if (f.parking) p.set("parking", "1");
  if (f.pets) p.set("pets", "1");
  if (f.within !== null) p.set("within", String(f.within));
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (f.view !== "list") p.set("view", f.view);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

export function browseHref(f: Filters): string {
  const qs = toSearchParams(f).toString();
  return qs ? `/browse?${qs}` : "/browse";
}

/** How many filters (not sort/view/page) are applied, for the "Filters (3)" button. */
export function activeFilterCount(f: Filters): number {
  return [
    f.minPrice !== null || f.maxPrice !== null,
    f.bedsMin !== null || f.bedsMax !== null,
    f.bathsMin !== null,
    f.moveIn !== null,
    f.types.length > 0,
    f.properties.length > 0,
    f.furnished,
    f.parking,
    f.pets,
    f.within !== null,
  ].filter(Boolean).length;
}

/** Properties logged with search_performed (no free text beyond the query length). */
export function searchAnalytics(f: Filters) {
  return {
    has_query: f.q.length > 0,
    filters: activeFilterCount(f),
    types: f.types,
    min_price: f.minPrice,
    max_price: f.maxPrice,
    beds_min: f.bedsMin,
    within: f.within,
    sort: f.sort,
    view: f.view,
  };
}
