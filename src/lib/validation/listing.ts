import { z } from "zod";
import {
  CAMPUS,
  LISTING_TYPES,
  MAX_MILES_FROM_CAMPUS,
  PROPERTY_TYPES,
  milesBetween,
  type ListingType,
  type PropertyType,
  type StepSlug,
} from "@/lib/listings/constants";
import type { Tables } from "@/lib/supabase/database.types";

// Shared by the listing form (client) and server actions, so a field is never
// accepted on one side and rejected on the other. FormData values are strings.

const listingTypeValues = LISTING_TYPES.map((t) => t.value) as [ListingType, ...ListingType[]];
const propertyTypeValues = PROPERTY_TYPES.map((t) => t.value) as [PropertyType, ...PropertyType[]];

// Unchecked boxes are simply absent from FormData, so the key must be optional.
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.null()])
  .optional()
  .transform((v) => v === "on" || v === "true");

function wholeNumber(min: number, max: number, message: string) {
  return z
    .string({ error: message })
    .trim()
    .transform((s) => s.replace(/[$,\s]/g, ""))
    .pipe(z.string().regex(/^\d+$/, message))
    .transform(Number)
    .pipe(z.number().int().min(min, message).max(max, message));
}

const isoDate = (message: string) =>
  z
    .string({ error: message })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), message);

/** Today's date in Boulder (YYYY-MM-DD), regardless of server timezone. */
export function todayInBoulder(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(now);
}

function addYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export const basicsSchema = z.object({
  listing_type: z.enum(listingTypeValues, { error: "Choose what you're listing." }),
  property_type: z.enum(propertyTypeValues, { error: "Choose the type of property." }),
  title: z
    .string({ error: "Add a title." })
    .trim()
    .min(5, "Use at least 5 characters.")
    .max(120, "Keep the title under 120 characters."),
  description: z
    .string({ error: "Add a description." })
    .trim()
    .min(30, "Describe the place in at least 30 characters.")
    .max(5000, "Keep the description under 5,000 characters."),
  bedrooms: wholeNumber(0, 10, "Enter 0–10 bedrooms (0 for a studio)."),
  bathrooms: z
    .string({ error: "Enter the number of bathrooms." })
    .trim()
    .regex(/^\d{1,2}(\.0|\.5)?$/, "Use whole or half numbers, like 1 or 1.5.")
    .transform(Number)
    .pipe(z.number().min(0.5, "Enter at least 0.5 bathrooms.").max(10, "Enter 10 or fewer bathrooms.")),
});

export const pricingSchema = z.object({
  monthly_rent: wholeNumber(100, 20000, "Enter monthly rent between $100 and $20,000, in whole dollars."),
  utilities_included: checkbox,
});

export const locationSchema = z
  .object({
    address: z
      .string({ error: "Enter the address." })
      .trim()
      .min(5, "Enter the full street address.")
      .max(200, "Keep the address under 200 characters."),
    neighborhood: z
      .string()
      .trim()
      .max(80, "Keep the neighborhood under 80 characters.")
      .optional()
      .transform((v) => v || null),
    latitude: z
      .string({ error: "Find the address on the map, or drop a pin." })
      .trim()
      .min(1, "Find the address on the map, or drop a pin.")
      .transform(Number)
      .pipe(z.number().min(-90).max(90)),
    longitude: z
      .string({ error: "Find the address on the map, or drop a pin." })
      .trim()
      .min(1, "Find the address on the map, or drop a pin.")
      .transform(Number)
      .pipe(z.number().min(-180).max(180)),
  })
  .refine((v) => milesBetween(CAMPUS, { lat: v.latitude, lng: v.longitude }) <= MAX_MILES_FROM_CAMPUS, {
    path: ["address"],
    message: `The location must be within ${MAX_MILES_FROM_CAMPUS} miles of CU Boulder.`,
  });

/** Lease end is required for subleases and takeovers, where it defines the term. */
export function availabilitySchema(listingType: ListingType | null, today = todayInBoulder()) {
  const needsEnd = listingType === "sublease" || listingType === "lease_takeover";
  const latest = addYears(today, 2);
  return z
    .object({
      available_date: isoDate("Choose the move-in date.")
        .refine((d) => d >= today, "The move-in date can't be in the past.")
        .refine((d) => d <= latest, "Choose a move-in date within the next 2 years."),
      lease_end_date: z
        .string()
        .trim()
        .optional()
        .transform((v) => v || null)
        .pipe(isoDate("Enter a valid date.").nullable()),
    })
    .superRefine((v, ctx) => {
      if (needsEnd && !v.lease_end_date) {
        ctx.addIssue({ code: "custom", path: ["lease_end_date"], message: "Add the date the lease ends." });
      }
      if (v.lease_end_date && v.lease_end_date <= v.available_date) {
        ctx.addIssue({ code: "custom", path: ["lease_end_date"], message: "The lease must end after the move-in date." });
      }
      if (v.lease_end_date && v.lease_end_date > addYears(v.available_date, 5)) {
        ctx.addIssue({ code: "custom", path: ["lease_end_date"], message: "Choose an end date within 5 years of move-in." });
      }
    });
}

export const amenitiesSchema = z.object({
  furnished: checkbox,
  parking: checkbox,
  pets_allowed: checkbox,
});

// ---------------------------------------------------------------------------
// Completeness: which steps a saved listing still needs.
// ---------------------------------------------------------------------------
type ListingRow = Pick<
  Tables<"listings">,
  | "listing_type"
  | "property_type"
  | "title"
  | "description"
  | "bedrooms"
  | "bathrooms"
  | "monthly_rent"
  | "utilities_included"
  | "address"
  | "neighborhood"
  | "latitude"
  | "longitude"
  | "available_date"
  | "lease_end_date"
>;

const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));

/** Converts a stored listing back into the form values a step submits. */
export function stepValues(step: StepSlug, l: ListingRow): Record<string, string | undefined> {
  switch (step) {
    case "basics":
      return {
        listing_type: str(l.listing_type),
        property_type: str(l.property_type),
        title: str(l.title),
        description: str(l.description),
        bedrooms: str(l.bedrooms),
        bathrooms: str(l.bathrooms),
      };
    case "pricing":
      return { monthly_rent: str(l.monthly_rent), utilities_included: String(l.utilities_included) };
    case "location":
      return {
        address: str(l.address),
        neighborhood: str(l.neighborhood),
        latitude: str(l.latitude),
        longitude: str(l.longitude),
      };
    case "availability":
      return { available_date: str(l.available_date), lease_end_date: str(l.lease_end_date) };
    default:
      return {};
  }
}

export type StepStatus = { slug: StepSlug; complete: boolean; problem?: string };

/** Per-step completion, used for the step navigation and the publish check. */
export function listingProgress(l: ListingRow, photoCount: number, today = todayInBoulder()): StepStatus[] {
  const check = (slug: StepSlug, schema: z.ZodType): StepStatus => {
    const r = schema.safeParse(stepValues(slug, l));
    return r.success ? { slug, complete: true } : { slug, complete: false, problem: r.error.issues[0]?.message };
  };
  return [
    check("basics", basicsSchema),
    check("pricing", pricingSchema),
    check("location", locationSchema),
    check("availability", availabilitySchema(l.listing_type, today)),
    { slug: "amenities", complete: true }, // all optional
    photoCount > 0
      ? { slug: "photos", complete: true }
      : { slug: "photos", complete: false, problem: "Add at least one photo." },
  ];
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
