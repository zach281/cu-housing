import Link from "next/link";
import { STEPS, type StepSlug } from "@/lib/listings/constants";
import type { StepStatus } from "@/lib/validation/listing";

/**
 * Step list for the listing form. Steps are a real sequence, so they're
 * numbered; finished steps get a check. Before the listing exists (step 1 of
 * a new listing) later steps aren't links yet.
 */
export function StepNav({
  listingId,
  current,
  progress,
}: {
  listingId: string | null;
  current: StepSlug;
  progress: StepStatus[];
}) {
  const done = new Set(progress.filter((p) => p.complete).map((p) => p.slug));
  const currentIndex = STEPS.findIndex((s) => s.slug === current);

  return (
    <nav aria-label="Listing steps" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <p className="mb-2 text-sm text-granite sm:hidden">
        Step {currentIndex + 1} of {STEPS.length}: <span className="font-semibold text-ink">{STEPS[currentIndex].label}</span>
      </p>
      <ol className="flex min-w-max gap-1 sm:min-w-0 sm:flex-wrap">
        {STEPS.map((s, i) => {
          const isCurrent = s.slug === current;
          const isDone = done.has(s.slug);
          const content = (
            <>
              <span
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isCurrent ? "bg-pine text-white" : isDone ? "bg-pine-wash text-pine-deep" : "bg-snow text-granite ring-1 ring-line"
                }`}
              >
                {isDone && !isCurrent ? "✓" : i + 1}
              </span>
              <span className={isCurrent ? "font-semibold text-ink" : "text-granite"}>{s.label}</span>
              {isDone && <span className="sr-only">(complete)</span>}
            </>
          );
          return (
            <li key={s.slug}>
              {listingId && !isCurrent ? (
                <Link
                  href={`/dashboard/listings/${listingId}/edit/${s.slug}`}
                  className="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm hover:bg-pine-wash"
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm ${isCurrent ? "bg-paper ring-1 ring-line" : "opacity-60"}`}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
