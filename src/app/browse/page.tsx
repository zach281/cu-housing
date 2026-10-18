import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { searchListings } from "@/lib/listings/search-server";
import { PAGE_SIZE, activeFilterCount, browseHref, parseFilters, type Filters } from "@/lib/listings/search";
import { todayInBoulder } from "@/lib/validation/listing";
import { ListingCard } from "@/components/listing-card";
import { buttonClass } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { site } from "@/lib/site";
import { BrowseProvider, FilterPanel, ResultsFrame, SearchBar, Toolbar } from "./browse-controls";
import { BrowseMap } from "./browse-map";

export const metadata: Metadata = {
  title: "Browse housing",
  description: `Apartments, rooms, subleases, and lease takeovers near ${site.university}.`,
};

export default function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Housing near {site.university}</h1>
      <Suspense fallback={<BrowseSkeleton />}>
        <Browse searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Browse({ searchParams }: { searchParams: PageProps<"/browse">["searchParams"] }) {
  const filters = parseFilters(await searchParams);
  const result = await searchListings(filters, { mapView: filters.view === "map" });
  const today = todayInBoulder();

  return (
    <BrowseProvider initial={filters}>
      <SearchBar />
      <div className="mt-6 gap-8 lg:grid lg:grid-cols-[16rem_1fr]">
        <FilterPanel total={result.total} />
        <section aria-label="Results" className="min-w-0 space-y-5">
          <Toolbar total={result.total} />
          <ResultsFrame>
            {result.failed ? (
              <FormMessage status="error">Listings couldn&apos;t load. Refresh the page to try again.</FormMessage>
            ) : result.listings.length === 0 ? (
              <EmptyState filters={filters} />
            ) : filters.view === "map" ? (
              <BrowseMap
                listings={result.listings
                  .filter((l) => l.lat !== null && l.lng !== null)
                  .map((l) => ({ id: l.id, title: l.title, rent: l.rent, bedrooms: l.bedrooms, lat: l.lat!, lng: l.lng! }))}
              />
            ) : (
              <>
                <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {result.listings.map((l) => (
                    <li key={l.id}>
                      <ListingCard listing={l} today={today} />
                    </li>
                  ))}
                </ul>
                <Pagination filters={filters} total={result.total} />
              </>
            )}
          </ResultsFrame>
        </section>
      </div>
    </BrowseProvider>
  );
}

function Pagination({ filters, total }: { filters: Filters; total: number }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const from = (filters.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(filters.page * PAGE_SIZE, total);
  return (
    <nav aria-label="Pages" className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-6">
      <p className="text-sm text-granite">
        {from}–{to} of {total.toLocaleString()}
      </p>
      <div className="flex gap-2">
        {filters.page > 1 && (
          <Link href={browseHref({ ...filters, page: filters.page - 1 })} className={buttonClass({ variant: "secondary", size: "sm" })}>
            Previous
          </Link>
        )}
        {filters.page < pages && (
          <Link href={browseHref({ ...filters, page: filters.page + 1 })} className={buttonClass({ variant: "secondary", size: "sm" })}>
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}

function EmptyState({ filters }: { filters: Filters }) {
  const filtered = activeFilterCount(filters) > 0 || filters.q.length > 0;
  return (
    <div className="rounded-xl border border-dashed border-line bg-paper p-8 text-center">
      {filtered ? (
        <>
          <p className="text-lg font-semibold text-ink">No places match your search</p>
          <p className="mx-auto mt-2 max-w-md text-granite">
            Try a wider price range, a later move-in date, or fewer filters.
          </p>
          <Link href={browseHref({ ...parseFilters({}), sort: filters.sort, view: filters.view })} className={buttonClass({ variant: "secondary", className: "mt-6" })}>
            Clear search and filters
          </Link>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold text-ink">No listings yet</p>
          <p className="mx-auto mt-2 max-w-md text-granite">
            Subletting for a semester or filling a room? Your listing could be the first one students see.
          </p>
          <Link href="/listings/new" className={buttonClass({ className: "mt-6" })}>
            List a property
          </Link>
        </>
      )}
    </div>
  );
}

function BrowseSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="h-13 rounded-xl bg-line/60" />
      <div className="mt-6 gap-8 lg:grid lg:grid-cols-[16rem_1fr]">
        <div className="hidden h-96 rounded-xl bg-line/40 lg:block" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[4/5] rounded-xl bg-line/40" />
          ))}
        </div>
      </div>
    </div>
  );
}
