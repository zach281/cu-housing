import type { ListingCardData } from "@/lib/listings/search-server";
import { LISTING_TYPE_LABEL, formatBaths, formatBeds, formatRent } from "@/lib/listings/constants";
import { todayInBoulder } from "@/lib/validation/listing";
import { VerificationBadge } from "@/components/verification-badge";

function availability(l: ListingCardData, today: string): string {
  const fmt = (d: string, withYear: boolean) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
  const thisYear = today.slice(0, 4);
  const from = l.availableDate <= today ? "Available now" : `Available ${fmt(l.availableDate, l.availableDate.slice(0, 4) !== thisYear)}`;
  return l.leaseEndDate ? `${from}, through ${fmt(l.leaseEndDate, l.leaseEndDate.slice(0, 4) !== thisYear)}` : from;
}

/** A listing in browse results. Shows only public-safe fields (no street address). */
export function ListingCard({ listing: l, today = todayInBoulder() }: { listing: ListingCardData; today?: string }) {
  const where = [l.neighborhood, l.miles !== null && `${l.miles < 0.1 ? "<0.1" : l.miles.toFixed(1)} mi from campus`]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-paper">
      <div className="relative aspect-[4/3] bg-pine-wash">
        {l.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL; thumbnails are pre-sized
          <img src={l.photo.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-granite">
            <svg viewBox="0 0 48 40" className="h-10 w-12 fill-none stroke-pine/50" strokeWidth="2" aria-hidden>
              <path d="M6 20 24 5l18 15M11 16v20h26V16M20 36V25h8v11" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span className="text-sm">No photos yet</span>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 rounded-full bg-paper/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
          {LISTING_TYPE_LABEL[l.listingType]}
        </span>
      </div>
      <div className="space-y-1.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xl font-bold tracking-tight text-ink">
            {formatRent(l.rent)}
            <span className="text-sm font-medium text-granite">/mo</span>
          </p>
          {l.utilitiesIncluded && <span className="text-xs font-medium text-pine-deep">Utilities included</span>}
        </div>
        <h3 className="line-clamp-1 font-semibold text-ink">{l.title}</h3>
        <p className="text-sm text-ink">
          {formatBeds(l.bedrooms)}, {formatBaths(l.bathrooms)}
        </p>
        {where && <p className="text-sm text-granite">{where}</p>}
        <p className="text-sm text-granite">{availability(l, today)}</p>
        {l.verification !== "unverified" && (
          <div className="pt-1">
            <VerificationBadge status={l.verification} />
          </div>
        )}
      </div>
    </article>
  );
}
