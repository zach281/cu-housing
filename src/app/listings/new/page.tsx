import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { FormMessage } from "@/components/ui/field";
import { createListing } from "@/app/dashboard/listings/actions";
import { StepNav } from "@/app/dashboard/listings/[id]/edit/step-nav";
import { BasicsForm } from "@/app/dashboard/listings/[id]/edit/steps/basics-form";

export const metadata: Metadata = { title: "List a property" };

export default function NewListingPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-ink sm:text-3xl">List a property</h1>
      <Suspense fallback={<p className="text-granite">Loading…</p>}>
        <NewListing />
      </Suspense>
    </div>
  );
}

async function NewListing() {
  const user = await requireUser("/listings/new");

  if (user.profile.account_status === "suspended") {
    return (
      <FormMessage status="error">
        Your account is suspended, so you can&apos;t post listings. Contact the site team if you think this is a mistake.
      </FormMessage>
    );
  }

  return (
    <>
      <StepNav listingId={null} current="basics" progress={[]} />
      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink">Basics</h2>
        <p className="mt-1 mb-6 text-granite">
          What kind of place it is. You can save a draft at any step and finish later.
        </p>
        <BasicsForm action={createListing} defaults={{}} backHref={null} />
      </section>
    </>
  );
}
