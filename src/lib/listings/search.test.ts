import { describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS, activeFilterCount, browseHref, parseFilters, toSearchParams } from "./search";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { supabaseUrl: "https://x.supabase.co", supabasePublishableKey: "k" } }));
const { applyFilters } = await import("./search-server");

describe("parseFilters", () => {
  it("returns defaults for an empty URL", () => {
    expect(parseFilters({})).toEqual(EMPTY_FILTERS);
  });

  it("reads every filter", () => {
    const f = parseFilters({
      q: " hill ",
      min_price: "900",
      max_price: "$1,400",
      beds_min: "2",
      beds_max: "4",
      baths_min: "1.5",
      move_in: "2027-08-01",
      type: "sublease,room",
      property: ["house", "apartment"],
      furnished: "1",
      parking: "true",
      pets: "on",
      within: "2",
      sort: "price_asc",
      view: "map",
      page: "3",
    });
    expect(f).toEqual({
      q: "hill",
      minPrice: 900,
      maxPrice: 1400,
      bedsMin: 2,
      bedsMax: 4,
      bathsMin: 1.5,
      moveIn: "2027-08-01",
      types: ["sublease", "room"],
      properties: ["house", "apartment"],
      furnished: true,
      parking: true,
      pets: true,
      within: 2,
      sort: "price_asc",
      view: "map",
      page: 3,
    });
  });

  it("ignores junk instead of erroring", () => {
    const f = parseFilters({
      min_price: "cheap",
      beds_min: "-1",
      baths_min: "1.25",
      move_in: "next fall",
      type: "castle,room",
      within: "7",
      sort: "random",
      page: "0",
      furnished: "maybe",
    });
    expect(f).toMatchObject({ minPrice: null, bedsMin: null, bathsMin: null, moveIn: null, types: ["room"], within: null, sort: "newest", page: 1, furnished: false });
  });

  it("swaps reversed ranges", () => {
    expect(parseFilters({ min_price: "2000", max_price: "1000" })).toMatchObject({ minPrice: 1000, maxPrice: 2000 });
    expect(parseFilters({ beds_min: "4", beds_max: "2" })).toMatchObject({ bedsMin: 2, bedsMax: 4 });
  });

  it("keeps studios (0 bedrooms) as a real filter", () => {
    expect(parseFilters({ beds_max: "0" }).bedsMax).toBe(0);
  });
});

describe("toSearchParams / browseHref", () => {
  it("round-trips", () => {
    const f = parseFilters({ q: "furnished", min_price: "800", type: "sublease", pets: "1", sort: "distance", page: "2" });
    expect(parseFilters(Object.fromEntries(toSearchParams(f)))).toEqual(f);
  });
  it("omits defaults so the plain page is just /browse", () => {
    expect(browseHref(EMPTY_FILTERS)).toBe("/browse");
    expect(browseHref({ ...EMPTY_FILTERS, bedsMin: 0 })).toBe("/browse?beds_min=0");
  });
});

describe("activeFilterCount", () => {
  it("counts ranges once and ignores sort, view, page and the text query", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: "x", minPrice: 1, maxPrice: 2, sort: "distance", view: "map", page: 4 })).toBe(1);
    expect(activeFilterCount({ ...EMPTY_FILTERS, types: ["room"], furnished: true, within: 1 })).toBe(3);
  });
});

describe("applyFilters", () => {
  // Records every builder call so we can check the exact database filters.
  function recorder() {
    const calls: unknown[][] = [];
    const proxy: Record<string, unknown> = new Proxy({}, { get: (_t, name) => (...args: unknown[]) => (calls.push([name, ...args]), proxy) });
    return { proxy, calls };
  }

  it("always limits to active listings", () => {
    const r = recorder();
    applyFilters(r.proxy, EMPTY_FILTERS);
    expect(r.calls).toEqual([["eq", "status", "active"]]);
  });

  it("maps each filter to the right column and operator", () => {
    const r = recorder();
    applyFilters(r.proxy, parseFilters({
      q: "quiet", min_price: "900", max_price: "1400", beds_min: "2", beds_max: "4", baths_min: "2",
      move_in: "2027-08-01", type: "room", property: "house", furnished: "1", parking: "1", pets: "1", within: "1",
    }));
    expect(r.calls).toEqual([
      ["eq", "status", "active"],
      ["textSearch", "search_vector", "quiet", { type: "websearch", config: "english" }],
      ["gte", "monthly_rent", 900],
      ["lte", "monthly_rent", 1400],
      ["gte", "bedrooms", 2],
      ["lte", "bedrooms", 4],
      ["gte", "bathrooms", 2],
      ["lte", "available_date", "2027-08-01"],
      ["or", "lease_end_date.is.null,lease_end_date.gt.2027-08-01"],
      ["in", "listing_type", ["room"]],
      ["in", "property_type", ["house"]],
      ["eq", "furnished", true],
      ["eq", "parking", true],
      ["eq", "pets_allowed", true],
      ["lte", "distance_from_campus_mi", 1],
    ]);
  });

  it("never touches private columns", () => {
    const r = recorder();
    applyFilters(r.proxy, parseFilters({ q: "x", within: "1", move_in: "2027-01-01" }));
    expect(JSON.stringify(r.calls)).not.toMatch(/"address"|"latitude"|"longitude"/);
  });
});
