import type { Metadata } from "next";

export const metadata: Metadata = { title: "Browse housing" };

// Replaced by search and filters in Milestone 3.
export default function BrowsePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Browse housing</h1>
      <p className="mt-3 max-w-prose text-granite">
        Search and filters are coming in the next builds. No listings have been published yet.
      </p>
    </div>
  );
}
