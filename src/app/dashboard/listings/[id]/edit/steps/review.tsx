import Link from "next/link";
import type { OwnListing } from "@/lib/listings/data";
import {
  LISTING_TYPE_LABEL,
  PROPERTY_TYPE_LABEL,
  STEPS,
  formatBaths,
  formatBeds,
  formatRent,
  milesBetween,
  CAMPUS,
} from "@/lib/listings/constants";
import type { StepStatus } from "@/lib/validation/listing";
import { publishListing } from "../../../actions";
import { PublishPanel } from "./publish-panel";

const dateFmt = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** What the listing will show, grouped by the step that sets each part. */
export function Review({ listing, progress }: { listing: OwnListing; progress: StepStatus[] }) {
  const problems = progress.filter((p) => !p.complete);
  const ready = problems.length === 0;
  const live = listing.status === "active";
  const cover = listing.images[0];
  const miles =
    listing.latitude !== null && listing.longitude !== null
      ? milesBetween(CAMPUS, { lat: Number(listing.latitude), lng: Number(listing.longitude) })
      : null;
  const amenities = [
    listing.furnished && "Furnished",
    listing.parking && "Parking",
    listing.pets_allowed && "Pets allowed",
    listing.utilities_included && "Utilities included",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      {problems.length > 0 && (
        <div className="rounded-lg border border-line bg-paper p-4">
          <p className="font-semibold text-ink">Still needed before publishing</p>
          <ul className="mt-2 space-y-1 text-sm">
            {problems.map((p) => (
              <li key={p.slug}>
                <Link href={`/dashboard/listings/${listing.id}/edit/${p.slug}`} className="font-semibold text-pine underline underline-offset-4">
                  {STEPS.find((s) => s.slug === p.slug)?.label}
                </Link>{" "}
                <span className="text-granite">{p.problem}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <article className="overflow-hidden rounded-xl border border-line bg-paper">
        <div className="aspect-[16/9] bg-pine-wash">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL
            <img src={cover.url} alt="Cover photo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-granite">No photos yet</div>
          )}
        </div>
        <div className="space-y-1 p-5">
          <p className="text-2xl font-bold text-ink">
            {listing.monthly_rent ? `${formatRent(listing.monthly_rent)}/mo` : "Rent not set"}
          </p>
          <h2 className="text-lg font-semibold text-ink">{listing.title ?? "Untitled listing"}</h2>
          <p className="text-sm text-granite">
            {[
              listing.bedrooms !== null && formatBeds(listing.bedrooms),
              listing.bathrooms !== null && formatBaths(Number(listing.bathrooms)),
              listing.neighborhood,
              miles !== null && `${miles.toFixed(1)} mi from campus`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="px-5 pb-1">
          <Section listingId={listing.id} step="basics">
            <p className="font-semibold">
              {listing.listing_type ? LISTING_TYPE_LABEL[listing.listing_type] : "Type not set"}
              {listing.property_type && ` · ${PROPERTY_TYPE_LABEL[listing.property_type]}`}
            </p>
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-granite">{listing.description ?? "No description yet."}</p>
          </Section>
          <Section listingId={listing.id} step="location">
            <p>{listing.address ?? "No address yet"}</p>
          </Section>
          <Section listingId={listing.id} step="availability">
            <p>
              Move in {dateFmt(listing.available_date)}
              {listing.lease_end_date && ` · lease ends ${dateFmt(listing.lease_end_date)}`}
            </p>
          </Section>
          <Section listingId={listing.id} step="amenities">
            <p>{amenities.length ? amenities.join(", ") : "No amenities selected"}</p>
          </Section>
          <Section listingId={listing.id} step="photos">
            <p>
              {listing.images.length} photo{listing.images.length === 1 ? "" : "s"}
            </p>
          </Section>
        </div>
      </article>

      {listing.status === "removed" ? null : live ? (
        <p className="text-sm text-granite">
          This listing is live. Changes you save on any step go live right away.{" "}
          <Link href="/dashboard/listings" className="font-semibold text-pine underline underline-offset-4">
            Back to my listings
          </Link>
        </p>
      ) : (
        <PublishPanel
          action={publishListing.bind(null, listing.id)}
          listingId={listing.id}
          ready={ready}
          label={listing.status === "unavailable" ? "Relist" : "Publish listing"}
        />
      )}
    </div>
  );
}

function Section({ listingId, step, children }: { listingId: string; step: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-4">
      <div className="min-w-0 flex-1 text-sm text-ink">{children}</div>
      <Link href={`/dashboard/listings/${listingId}/edit/${step}`} className="shrink-0 text-sm font-semibold text-pine underline underline-offset-4">
        Edit
      </Link>
    </div>
  );
}
