"use server";

import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { geocode, type GeocodeResult } from "@/lib/listings/geocode";
import { getOwnListing } from "@/lib/listings/data";
import { thumbPathFor } from "@/lib/listings/images";
import { isStepSlug, nextStep, type StepSlug } from "@/lib/listings/constants";
import {
  amenitiesSchema,
  availabilitySchema,
  basicsSchema,
  fieldErrors,
  listingProgress,
  locationSchema,
  pricingSchema,
} from "@/lib/validation/listing";
import type { FormState } from "@/lib/validation/form-state";
import type { TablesUpdate } from "@/lib/supabase/database.types";

// Every action re-checks the session and relies on Row Level Security; the
// owner_id filters are a second guard, not the only one.

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/listings");
  return { supabase, userId: user.id };
}

function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

function dbErrorMessage(error: PostgrestError | null): string {
  if (!error) return "Something went wrong. Try again.";
  if (error.code === "PT429" || error.message.includes("listing_rate_limit")) {
    return "You've created 10 listings in the last 24 hours. Try again tomorrow, or edit an existing draft.";
  }
  if (error.code === "42501") {
    return "You can't change this listing. If your account is suspended, contact the site team.";
  }
  if (error.code === "23514") return "Some details aren't valid. Check the form and try again.";
  console.error("Listing write failed", error);
  return `Your changes didn't save (${error.code ?? "error"}). Try again.`;
}

// ---------------------------------------------------------------------------
// Create (step 1)
// ---------------------------------------------------------------------------
export async function createListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = basicsSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const { supabase, userId } = await currentUserId();
  const { data, error } = await supabase
    .from("listings")
    .insert({ owner_id: userId, ...parsed.data })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: dbErrorMessage(error), values };

  redirect(values.intent === "exit" ? "/dashboard/listings?saved=1" : `/dashboard/listings/${data.id}/edit/pricing`);
}

// ---------------------------------------------------------------------------
// Save any later step
// ---------------------------------------------------------------------------
export async function saveListingStep(
  listingId: string,
  step: StepSlug,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isStepSlug(step) || step === "photos" || step === "review") return { status: "error", message: "Unknown step." };
  const values = formValues(formData);
  const { supabase, userId } = await currentUserId();
  const listing = await getOwnListing(userId, listingId);
  if (!listing) return { status: "error", message: "This listing doesn't exist or isn't yours." };
  if (listing.status === "removed") return { status: "error", message: "This listing was removed by a moderator and can't be edited." };

  let update: TablesUpdate<"listings">;
  switch (step) {
    case "basics": {
      const r = basicsSchema.safeParse(values);
      if (!r.success) return { status: "error", fieldErrors: fieldErrors(r.error), values };
      // Changing to a sublease/takeover makes the lease end date required.
      if (listing.status !== "draft" && (r.data.listing_type === "sublease" || r.data.listing_type === "lease_takeover") && !listing.lease_end_date) {
        return { status: "error", fieldErrors: { listing_type: "Add a lease end date on the Availability step first." }, values };
      }
      update = r.data;
      break;
    }
    case "pricing": {
      const r = pricingSchema.safeParse(values);
      if (!r.success) return { status: "error", fieldErrors: fieldErrors(r.error), values };
      update = r.data;
      break;
    }
    case "location": {
      const r = locationSchema.safeParse(values);
      if (!r.success) return { status: "error", fieldErrors: fieldErrors(r.error), values };
      update = r.data;
      break;
    }
    case "availability": {
      const r = availabilitySchema(listing.listing_type).safeParse(values);
      if (!r.success) return { status: "error", fieldErrors: fieldErrors(r.error), values };
      update = r.data;
      break;
    }
    case "amenities": {
      const r = amenitiesSchema.safeParse(values);
      if (!r.success) return { status: "error", fieldErrors: fieldErrors(r.error), values };
      update = r.data;
      break;
    }
  }

  const { data, error } = await supabase
    .from("listings")
    .update(update)
    .eq("id", listingId)
    .eq("owner_id", userId)
    .select("id");
  if (error || !data?.length) return { status: "error", message: dbErrorMessage(error), values };

  redirect(values.intent === "exit" ? "/dashboard/listings?saved=1" : `/dashboard/listings/${listingId}/edit/${nextStep(step)}`);
}

// ---------------------------------------------------------------------------
// Address lookup (signed-in only, so it can't be used as an open proxy)
// ---------------------------------------------------------------------------
export async function lookupAddress(address: string): Promise<GeocodeResult | { ok: false; reason: "invalid" }> {
  await currentUserId();
  if (typeof address !== "string" || address.trim().length < 5 || address.length > 200) {
    return { ok: false, reason: "invalid" };
  }
  return geocode(address);
}

// ---------------------------------------------------------------------------
// Publish / status changes / delete
// ---------------------------------------------------------------------------
export type ListingActionState = { status: "idle" | "error"; message?: string; problems?: { slug: StepSlug; problem: string }[] };

export async function publishListing(listingId: string): Promise<ListingActionState> {
  const { supabase, userId } = await currentUserId();
  const listing = await getOwnListing(userId, listingId);
  if (!listing) return { status: "error", message: "This listing doesn't exist or isn't yours." };
  if (listing.status === "removed") return { status: "error", message: "This listing was removed by a moderator." };

  const problems = listingProgress(listing, listing.images.length)
    .filter((s) => !s.complete)
    .map((s) => ({ slug: s.slug, problem: s.problem ?? "Incomplete" }));
  if (problems.length) return { status: "error", message: "Finish these steps before publishing.", problems };

  const firstPublish = !listing.published_at;
  const { data, error } = await supabase
    .from("listings")
    .update({ status: "active" })
    .eq("id", listingId)
    .eq("owner_id", userId)
    .select("id");
  if (error || !data?.length) return { status: "error", message: dbErrorMessage(error) };

  if (firstPublish) {
    const { error: trackError } = await supabase.rpc("track_event", { p_event_name: "listing_created", p_listing_id: listingId });
    if (trackError) console.error("track_event listing_created failed", trackError);
  }
  redirect(`/dashboard/listings?published=${listingId}`);
}

export async function markUnavailable(listingId: string): Promise<ListingActionState> {
  const { supabase, userId } = await currentUserId();
  const { data, error } = await supabase
    .from("listings")
    .update({ status: "unavailable" })
    .eq("id", listingId)
    .eq("owner_id", userId)
    .eq("status", "active")
    .select("id");
  if (error || !data?.length) return { status: "error", message: dbErrorMessage(error) };
  redirect("/dashboard/listings");
}

/** Relisting an unavailable listing re-runs the publish checks (e.g. move-in date not in the past). */
export async function relistListing(listingId: string): Promise<ListingActionState> {
  return publishListing(listingId);
}

export async function deleteDraft(listingId: string): Promise<ListingActionState> {
  const { supabase, userId } = await currentUserId();
  const listing = await getOwnListing(userId, listingId);
  if (!listing) return { status: "error", message: "This listing doesn't exist or isn't yours." };
  if (listing.status !== "draft") return { status: "error", message: "Only drafts can be deleted. Mark a live listing unavailable instead." };

  const { data, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("owner_id", userId)
    .eq("status", "draft")
    .select("id");
  if (error || !data?.length) return { status: "error", message: dbErrorMessage(error) };

  // Clean up the draft's photo files (image rows were deleted by cascade).
  const paths = listing.images.flatMap((i) => [i.storage_path, thumbPathFor(i.storage_path)]);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("listing-images").remove(paths);
    if (storageError) console.error("Removing draft photos failed", storageError);
  }
  redirect("/dashboard/listings?deleted=1");
}
