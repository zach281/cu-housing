import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "List a property" };

// Replaced by the multi-step listing form in Milestone 2. Already requires
// sign-in, so the auth gate can be tested now.
export default function NewListingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink">List a property</h1>
      <Suspense fallback={null}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  const user = await requireUser("/listings/new");
  return (
    <p className="mt-3 max-w-prose text-granite">
      You&apos;re signed in as {user.profile.name || user.email}. The listing form is the next thing being built.
    </p>
  );
}
