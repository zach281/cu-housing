import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getOwnListings, type OwnListing } from "@/lib/listings/data";
import { STATUS_LABEL, STEPS, formatBeds, formatRent } from "@/lib/listings/constants";
import { listingProgress } from "@/lib/validation/listing";
import { buttonClass } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { ListingRowActions } from "./listing-row-actions";

export const metadata: Metadata = { title: "My listings" };

export default function MyListingsPage({ searchParams }: PageProps<"/dashboard/listings">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink">My listings</h1>
        <Link href="/listings/new" className={buttonClass()}>
          List a property
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-granite">Loading your listings…</p>}>
        <Listings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const STATUS_STYLE = {
  draft: "bg-snow text-granite ring-line",
  active: "bg-pine-wash text-pine-deep ring-pine/30",
  unavailable: "bg-snow text-granite ring-line",
  removed: "bg-danger-wash text-danger ring-danger/30",
} as const;

async function Listings({ searchParams }: { searchParams: PageProps<"/dashboard/listings">["searchParams"] }) {
  const user = await requireUser("/dashboard/listings");
  const [listings, params] = await Promise.all([getOwnListings(user.id), searchParams]);

  const notice =
    params.published ? "Your listing is live." : params.saved ? "Draft saved." : params.deleted ? "Draft deleted." : null;

  return (
    <>
      {notice && (
        <div className="mt-6">
          <FormMessage status="success">{notice}</FormMessage>
        </div>
      )}
      {listings.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line bg-paper p-8 text-center">
          <p className="text-lg font-semibold text-ink">You haven&apos;t listed anything yet</p>
          <p className="mx-auto mt-2 max-w-md text-granite">
            Subletting for a semester, filling a room, or renting out a house? Create a listing in a few minutes. You
            can save a draft and come back.
          </p>
          <Link href="/listings/new" className={buttonClass({ className: "mt-6" })}>
            List a property
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {listings.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </ul>
      )}
    </>
  );
}

function ListingRow({ listing: l }: { listing: OwnListing }) {
  const cover = l.images[0];
  const nextIncomplete = listingProgress(l, l.images.length).find((p) => !p.complete);
  const nextLabel = nextIncomplete ? STEPS.find((s) => s.slug === nextIncomplete.slug)?.label : null;
  const updated = new Date(l.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-line bg-paper p-4 sm:flex-row">
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-pine-wash sm:w-44">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL; thumbnail is pre-sized
          <img src={cover.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-granite">No photo</div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-ink">{l.title ?? "Untitled draft"}</h2>
            <p className="text-sm text-granite">
              {[l.monthly_rent && `${formatRent(l.monthly_rent)}/mo`, l.bedrooms !== null && formatBeds(l.bedrooms), l.neighborhood]
                .filter(Boolean)
                .join(" · ") || "Details not filled in yet"}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_STYLE[l.status]}`}>
            {STATUS_LABEL[l.status]}
          </span>
        </div>

        {l.status === "draft" && (
          <p className="text-sm text-granite">
            {nextLabel ? `Next: ${nextLabel}.` : "Ready to publish."} Updated {updated}.
          </p>
        )}
        {l.status === "removed" && (
          <p className="text-sm text-danger">Removed by a moderator{l.removal_reason ? `: ${l.removal_reason}` : "."}</p>
        )}
        {l.status !== "draft" && l.status !== "removed" && <p className="text-sm text-granite">Updated {updated}.</p>}

        <ListingRowActions id={l.id} status={l.status} resumeStep={nextIncomplete?.slug ?? "review"} />
      </div>
    </li>
  );
}
