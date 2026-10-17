import type { Enums } from "@/lib/supabase/database.types";

export type ListingType = Enums<"listing_type">;
export type PropertyType = Enums<"property_type">;
export type ListingStatus = Enums<"listing_status">;

export const LISTING_TYPES: { value: ListingType; label: string; hint: string }[] = [
  { value: "lease", label: "Whole place", hint: "An apartment or house on a new lease" },
  { value: "room", label: "Room", hint: "A bedroom in a shared place" },
  { value: "sublease", label: "Sublease", hint: "Temporary; the original tenant keeps the lease" },
  { value: "lease_takeover", label: "Lease takeover", hint: "The lease transfers to the new tenant" },
];

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "townhouse", label: "Townhouse" },
  { value: "condo", label: "Condo" },
  { value: "duplex", label: "Duplex" },
  { value: "studio", label: "Studio" },
  { value: "other", label: "Other" },
];

export const LISTING_TYPE_LABEL = Object.fromEntries(LISTING_TYPES.map((t) => [t.value, t.label])) as Record<
  ListingType,
  string
>;
export const PROPERTY_TYPE_LABEL = Object.fromEntries(PROPERTY_TYPES.map((t) => [t.value, t.label])) as Record<
  PropertyType,
  string
>;

export const AMENITIES = [
  { key: "furnished", label: "Furnished" },
  { key: "parking", label: "Parking available" },
  { key: "pets_allowed", label: "Pets allowed" },
] as const;

// Suggestions only; posters can type any neighborhood.
export const BOULDER_NEIGHBORHOODS = [
  "University Hill",
  "Goss-Grove",
  "Martin Acres",
  "Table Mesa",
  "Baseline",
  "Williams Village",
  "Downtown / Pearl Street",
  "Whittier",
  "Mapleton Hill",
  "Central Boulder",
  "East Boulder",
  "North Boulder",
  "Gunbarrel",
  "Frasier Meadows",
  "Louisville",
  "Lafayette",
  "Superior",
];

export const MAX_PHOTOS = 15; // mirrors listing_images_enforce_limit()
export const MAX_MILES_FROM_CAMPUS = 25;

// Norlin Library, CU Boulder. Mirrors public.miles_from_campus() in SQL.
export const CAMPUS = { lat: 40.00848, lng: -105.27063 } as const;

export const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: "Draft",
  active: "Live",
  unavailable: "Unavailable",
  removed: "Removed",
};

/** Ordered steps of the listing form. Slugs appear in URLs. */
export const STEPS = [
  { slug: "basics", label: "Basics" },
  { slug: "pricing", label: "Pricing" },
  { slug: "location", label: "Location" },
  { slug: "availability", label: "Availability" },
  { slug: "amenities", label: "Amenities" },
  { slug: "photos", label: "Photos" },
  { slug: "review", label: "Review" },
] as const;

export type StepSlug = (typeof STEPS)[number]["slug"];
export const isStepSlug = (s: string): s is StepSlug => STEPS.some((x) => x.slug === s);

export function nextStep(slug: StepSlug): StepSlug {
  const i = STEPS.findIndex((s) => s.slug === slug);
  return STEPS[Math.min(i + 1, STEPS.length - 1)].slug;
}
export function prevStep(slug: StepSlug): StepSlug | null {
  const i = STEPS.findIndex((s) => s.slug === slug);
  return i > 0 ? STEPS[i - 1].slug : null;
}

/** Great-circle distance in miles (matches public.miles_from_campus). */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

export const formatRent = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function formatBeds(bedrooms: number) {
  return bedrooms === 0 ? "Studio" : `${bedrooms} bed${bedrooms === 1 ? "" : "s"}`;
}
export function formatBaths(bathrooms: number) {
  return `${bathrooms} bath${bathrooms === 1 ? "" : "s"}`;
}
