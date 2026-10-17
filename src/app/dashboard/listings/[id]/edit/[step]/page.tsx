import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getOwnListing } from "@/lib/listings/data";
import { STATUS_LABEL, STEPS, isStepSlug, prevStep, type StepSlug } from "@/lib/listings/constants";
import { listingProgress, stepValues, todayInBoulder } from "@/lib/validation/listing";
import { FormMessage } from "@/components/ui/field";
import { saveListingStep } from "../../../actions";
import { StepNav } from "../step-nav";
import { BasicsForm } from "../steps/basics-form";
import { AmenitiesForm, AvailabilityForm, PricingForm } from "../steps/simple-forms";
import { LocationForm } from "../steps/location-form";
import { PhotosManager } from "../steps/photos-manager";
import { Review } from "../steps/review";

export const metadata: Metadata = { title: "Edit listing" };

const INTRO: Record<StepSlug, string> = {
  basics: "What kind of place it is.",
  pricing: "What it costs each month.",
  location: "Where it is. Students can filter by distance from campus.",
  availability: "When someone can move in.",
  amenities: "What comes with the place.",
  photos: "Listings with photos get far more attention.",
  review: "Check everything, then publish.",
};

export default function EditListingPage({ params }: PageProps<"/dashboard/listings/[id]/edit/[step]">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense fallback={<p className="text-granite">Loading your listing…</p>}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: PageProps<"/dashboard/listings/[id]/edit/[step]">["params"] }) {
  const { id, step } = await params;
  if (!isStepSlug(step)) notFound();
  const user = await requireUser(`/dashboard/listings/${id}/edit/${step}`);
  const listing = await getOwnListing(user.id, id);
  if (!listing) notFound();

  const today = todayInBoulder();
  const progress = listingProgress(listing, listing.images.length, today);
  const prev = prevStep(step);
  const backHref = prev ? `/dashboard/listings/${id}/edit/${prev}` : null;
  const stepLabel = STEPS.find((s) => s.slug === step)!.label;

  if (listing.status === "removed") {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{listing.title ?? "Listing"}</h1>
        <div className="mt-6">
          <FormMessage status="error">
            A moderator removed this listing{listing.removal_reason ? `: ${listing.removal_reason}` : "."} It can&apos;t be edited or relisted.
          </FormMessage>
        </div>
        <Link href="/dashboard/listings" className="mt-6 inline-block font-semibold text-pine underline underline-offset-4">
          Back to my listings
        </Link>
      </>
    );
  }

  const action = saveListingStep.bind(null, id, step);
  const defaults = stepValues(step, listing);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{listing.title ?? "New listing"}</h1>
        <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-granite ring-1 ring-line">
          {STATUS_LABEL[listing.status]}
        </span>
      </div>
      <StepNav listingId={id} current={step} progress={progress} />

      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink">{stepLabel}</h2>
        <p className="mt-1 mb-6 text-granite">{INTRO[step]}</p>

        {step === "basics" && <BasicsForm action={action} defaults={defaults} backHref={backHref} />}
        {step === "pricing" && <PricingForm action={action} defaults={defaults} backHref={backHref} />}
        {step === "location" && <LocationForm action={action} defaults={defaults} backHref={backHref} />}
        {step === "availability" && (
          <AvailabilityForm
            action={action}
            defaults={defaults}
            backHref={backHref}
            today={today}
            endRequired={listing.listing_type === "sublease" || listing.listing_type === "lease_takeover"}
          />
        )}
        {step === "amenities" && (
          <AmenitiesForm
            action={action}
            backHref={backHref}
            defaults={{
              furnished: String(listing.furnished),
              parking: String(listing.parking),
              pets_allowed: String(listing.pets_allowed),
            }}
          />
        )}
        {step === "photos" && (
          <PhotosManager
            listingId={id}
            userId={user.id}
            initial={listing.images.map(({ id, storage_path, display_order }) => ({ id, storage_path, display_order }))}
            backHref={`/dashboard/listings/${id}/edit/amenities`}
            nextHref={`/dashboard/listings/${id}/edit/review`}
          />
        )}
        {step === "review" && <Review listing={listing} progress={progress} />}
      </section>
    </>
  );
}
