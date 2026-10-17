import { describe, expect, it } from "vitest";
import {
  amenitiesSchema,
  availabilitySchema,
  basicsSchema,
  listingProgress,
  locationSchema,
  pricingSchema,
  todayInBoulder,
} from "./listing";

const basics = {
  listing_type: "sublease",
  property_type: "apartment",
  title: "Sunny room on the Hill",
  description: "Furnished room, 5 minute walk to campus, two quiet roommates.",
  bedrooms: "3",
  bathrooms: "1.5",
};

describe("basicsSchema", () => {
  it("accepts a complete listing and converts numbers", () => {
    const r = basicsSchema.parse(basics);
    expect(r).toMatchObject({ bedrooms: 3, bathrooms: 1.5, listing_type: "sublease" });
  });

  it("allows 0 bedrooms (studio)", () => {
    expect(basicsSchema.safeParse({ ...basics, bedrooms: "0" }).success).toBe(true);
  });

  it.each([
    ["unknown listing type", { listing_type: "castle" }, "listing_type"],
    ["missing property type", { property_type: undefined }, "property_type"],
    ["short title", { title: "Hi" }, "title"],
    ["short description", { description: "Nice place." }, "description"],
    ["negative bedrooms", { bedrooms: "-1" }, "bedrooms"],
    ["fractional bedrooms", { bedrooms: "2.5" }, "bedrooms"],
    ["11 bedrooms", { bedrooms: "11" }, "bedrooms"],
    ["quarter bathrooms", { bathrooms: "1.25" }, "bathrooms"],
    ["zero bathrooms", { bathrooms: "0" }, "bathrooms"],
    ["text bathrooms", { bathrooms: "two" }, "bathrooms"],
  ])("rejects %s", (_label, patch, field) => {
    const r = basicsSchema.safeParse({ ...basics, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path[0]).toBe(field);
  });
});

describe("pricingSchema", () => {
  it("accepts $ signs and commas", () => {
    expect(pricingSchema.parse({ monthly_rent: "$1,250", utilities_included: "on" })).toEqual({
      monthly_rent: 1250,
      utilities_included: true,
    });
  });
  it("treats an absent checkbox as false", () => {
    expect(pricingSchema.parse({ monthly_rent: "900" }).utilities_included).toBe(false);
  });
  it.each(["", "abc", "12.50", "50", "25000"])("rejects rent %j", (rent) => {
    expect(pricingSchema.safeParse({ monthly_rent: rent }).success).toBe(false);
  });
});

describe("locationSchema", () => {
  const near = { address: "1100 College Ave, Boulder, CO", latitude: "40.004", longitude: "-105.277" };
  it("accepts a Boulder address and blanks an empty neighborhood", () => {
    expect(locationSchema.parse({ ...near, neighborhood: "" })).toMatchObject({ latitude: 40.004, neighborhood: null });
  });
  it("requires a pin", () => {
    const r = locationSchema.safeParse({ ...near, latitude: "", longitude: "" });
    expect(r.success).toBe(false);
  });
  it("rejects places far from campus (Denver is fine, Chicago is not)", () => {
    expect(locationSchema.safeParse({ ...near, latitude: "39.7392", longitude: "-104.9903" }).success).toBe(true);
    const chicago = locationSchema.safeParse({ ...near, latitude: "41.8781", longitude: "-87.6298" });
    expect(chicago.success).toBe(false);
    expect(chicago.error?.issues[0].message).toMatch(/within 25 miles/);
  });
});

describe("availabilitySchema", () => {
  const today = "2026-10-16";
  it("requires an end date for subleases but not leases", () => {
    expect(availabilitySchema("sublease", today).safeParse({ available_date: "2027-01-01" }).success).toBe(false);
    expect(availabilitySchema("lease", today).safeParse({ available_date: "2027-01-01" }).success).toBe(true);
  });
  it.each([
    ["past move-in", { available_date: "2026-10-15" }],
    ["move-in more than 2 years out", { available_date: "2028-10-17" }],
    ["end before move-in", { available_date: "2027-08-01", lease_end_date: "2027-07-01" }],
    ["end equal to move-in", { available_date: "2027-08-01", lease_end_date: "2027-08-01" }],
    ["end 6 years later", { available_date: "2027-08-01", lease_end_date: "2033-08-02" }],
    ["malformed date", { available_date: "08/01/2027" }],
  ])("rejects %s", (_label, values) => {
    expect(availabilitySchema("lease", today).safeParse(values).success).toBe(false);
  });
  it("accepts today", () => {
    expect(availabilitySchema("room", today).safeParse({ available_date: today }).success).toBe(true);
  });
});

describe("amenitiesSchema", () => {
  it("maps checkboxes to booleans", () => {
    expect(amenitiesSchema.parse({ furnished: "on" })).toEqual({ furnished: true, parking: false, pets_allowed: false });
  });
});

describe("todayInBoulder", () => {
  it("uses Mountain time, not UTC", () => {
    // 2026-10-17 03:00 UTC is still Oct 16 in Boulder.
    expect(todayInBoulder(new Date("2026-10-17T03:00:00Z"))).toBe("2026-10-16");
  });
});

describe("listingProgress", () => {
  const complete = {
    listing_type: "lease" as const,
    property_type: "house" as const,
    title: "Four bedroom house",
    description: "Big yard, two blocks from the bus line, washer and dryer.",
    bedrooms: 4,
    bathrooms: 2,
    monthly_rent: 3600,
    utilities_included: false,
    address: "800 Broadway, Boulder, CO",
    neighborhood: null,
    latitude: 40.008,
    longitude: -105.279,
    available_date: "2027-08-01",
    lease_end_date: null,
  };
  it("is complete with every step filled and a photo", () => {
    expect(listingProgress(complete, 1, "2026-10-16").every((s) => s.complete)).toBe(true);
  });
  it("flags a new draft's missing steps and explains why", () => {
    const empty = Object.fromEntries(Object.keys(complete).map((k) => [k, null])) as unknown as typeof complete;
    const p = listingProgress({ ...empty, title: "Draft" }, 0, "2026-10-16");
    expect(p.filter((s) => !s.complete).map((s) => s.slug)).toEqual(["basics", "pricing", "location", "availability", "photos"]);
    expect(p.find((s) => s.slug === "photos")?.problem).toMatch(/at least one photo/);
  });
  it("flags a stale move-in date on an old listing", () => {
    const stale = listingProgress({ ...complete, available_date: "2026-09-01" }, 3, "2026-10-16");
    expect(stale.find((s) => s.slug === "availability")?.complete).toBe(false);
  });
});
