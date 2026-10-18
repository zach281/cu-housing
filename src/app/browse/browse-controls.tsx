"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { LISTING_TYPES, PROPERTY_TYPES, type ListingType, type PropertyType } from "@/lib/listings/constants";
import {
  DISTANCES,
  EMPTY_FILTERS,
  SORTS,
  activeFilterCount,
  browseHref,
  toSearchParams,
  type Filters,
  type Sort,
} from "@/lib/listings/search";
import { buttonClass } from "@/components/ui/button";
import { trackSearch } from "./actions";

// ---------------------------------------------------------------------------
// State: filters live in the URL. Controls update local state immediately (so
// typing feels instant) and push the URL after a short pause; the server then
// re-renders the results.
// ---------------------------------------------------------------------------
type Ctx = {
  filters: Filters;
  update: (patch: Partial<Filters>, opts?: { debounce?: boolean }) => void;
  reset: () => void;
  pending: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
};
const BrowseContext = createContext<Ctx | null>(null);
const useBrowse = () => {
  const c = use(BrowseContext);
  if (!c) throw new Error("useBrowse outside BrowseProvider");
  return c;
};

/** Keys whose change counts as a new search (for analytics and page reset). */
const SEARCH_KEYS: (keyof Filters)[] = ["q", "minPrice", "maxPrice", "bedsMin", "bedsMax", "bathsMin", "moveIn", "types", "properties", "furnished", "parking", "pets", "within"];

export function BrowseProvider({ initial, children }: { initial: Filters; children: ReactNode }) {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);

  // Follow URL changes we didn't make (back/forward buttons, pagination links).
  const initialKey = toSearchParams(initial).toString();
  useEffect(() => {
    if (toSearchParams(latest.current).toString() !== initialKey) {
      latest.current = initial;
      setFilters(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the canonical query string
  }, [initialKey]);

  // Discrete choices get their own history entry (Back undoes them); typed
  // input replaces the current entry so Back isn't one step per keystroke.
  const navigate = (next: Filters, isNewSearch: boolean, typed: boolean) => {
    startTransition(() =>
      typed ? router.replace(browseHref(next), { scroll: false }) : router.push(browseHref(next), { scroll: false }),
    );
    if (isNewSearch) {
      if (trackTimer.current) clearTimeout(trackTimer.current);
      trackTimer.current = setTimeout(() => void trackSearch(toSearchParams(next).toString()), 1500);
    }
  };

  const update: Ctx["update"] = (patch, opts) => {
    const isNewSearch = SEARCH_KEYS.some((k) => k in patch);
    const next = { ...latest.current, ...patch, ...(isNewSearch || "sort" in patch ? { page: 1 } : {}) };
    latest.current = next;
    setFilters(next);
    if (timer.current) clearTimeout(timer.current);
    if (opts?.debounce) timer.current = setTimeout(() => navigate(next, isNewSearch, true), 400);
    else navigate(next, isNewSearch, false);
  };

  const reset = () => update({ ...EMPTY_FILTERS, sort: latest.current.sort, view: latest.current.view });

  return <BrowseContext value={{ filters, update, reset, pending, panelOpen, setPanelOpen }}>{children}</BrowseContext>;
}

/** Dims results while new ones load; announces the busy state to screen readers. */
export function ResultsFrame({ children }: { children: ReactNode }) {
  const { pending } = useBrowse();
  return (
    <div aria-busy={pending} className={`transition-opacity duration-150 ${pending ? "opacity-50" : ""}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search bar
// ---------------------------------------------------------------------------
export function SearchBar() {
  const { filters, update } = useBrowse();
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
      <label htmlFor="browse-q" className="sr-only">
        Search listings
      </label>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 fill-none stroke-granite" strokeWidth="2" aria-hidden>
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="m13 13 4 4" strokeLinecap="round" />
      </svg>
      <input
        id="browse-q"
        type="search"
        value={filters.q}
        onChange={(e) => update({ q: e.target.value }, { debounce: true })}
        placeholder="Search by neighborhood or keyword, like Hill, furnished, or quiet"
        maxLength={100}
        className="block h-13 w-full rounded-xl border border-line bg-paper pr-4 pl-12 text-base text-ink placeholder:text-granite/70 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Toolbar: result count, filters button (phones), sort, list/map
// ---------------------------------------------------------------------------
export function Toolbar({ total }: { total: number }) {
  const { filters, update, panelOpen, setPanelOpen } = useBrowse();
  const count = activeFilterCount(filters);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-granite" aria-live="polite">
        <span className="font-semibold text-ink">{total.toLocaleString()}</span> {total === 1 ? "place" : "places"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonClass({ variant: "secondary", size: "sm", className: "lg:hidden" })}
          onClick={() => setPanelOpen(true)}
          aria-controls="filters-panel"
          aria-expanded={panelOpen}
        >
          Filters{count > 0 && ` (${count})`}
        </button>
        <label className="sr-only" htmlFor="browse-sort">
          Sort
        </label>
        <select
          id="browse-sort"
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value as Sort })}
          className="h-9 rounded-lg border border-line bg-paper px-2.5 text-sm text-ink focus:border-pine focus:outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <div role="group" aria-label="View" className="flex rounded-lg border border-line bg-paper p-0.5">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={filters.view === v}
              onClick={() => update({ view: v })}
              className="h-8 rounded-md px-3 text-sm font-semibold text-granite aria-pressed:bg-pine aria-pressed:text-white"
            >
              {v === "list" ? "List" : "Map"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter panel: sidebar on large screens, full-screen sheet on phones
// ---------------------------------------------------------------------------
const BED_OPTIONS = [
  { value: "", label: "Any" },
  { value: "0", label: "Studio" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5+" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <fieldset className="space-y-2.5">
        <legend className="mb-2.5 text-sm font-semibold text-ink">{title}</legend>
        {children}
      </fieldset>
    </div>
  );
}

function Chip({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink has-checked:border-pine has-checked:bg-pine-wash has-checked:font-semibold has-checked:text-pine-deep has-focus-visible:ring-2 has-focus-visible:ring-pine">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[$,]/g, "")) || (s.trim() === "0" ? 0 : null));
const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

export function FilterPanel({ total }: { total: number }) {
  const { filters: f, update, reset, panelOpen, setPanelOpen } = useBrowse();
  const close = () => setPanelOpen(false);
  const count = activeFilterCount(f);

  // Phone sheet: lock page scroll behind it and close on Escape.
  useEffect(() => {
    if (!panelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanelOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [panelOpen, setPanelOpen]);

  // Local text for price inputs so partial typing ("1,") isn't fought by the URL.
  const [minText, setMinText] = useState(f.minPrice?.toString() ?? "");
  const [maxText, setMaxText] = useState(f.maxPrice?.toString() ?? "");
  // Follow outside changes (Clear all, back button) without fighting mid-typing.
  if (numOrNull(minText) !== f.minPrice) setMinText(f.minPrice?.toString() ?? "");
  if (numOrNull(maxText) !== f.maxPrice) setMaxText(f.maxPrice?.toString() ?? "");

  return (
    <aside
      id="filters-panel"
      aria-label="Filters"
      className={`${panelOpen ? "fixed inset-0 z-50 block overflow-y-auto bg-snow p-4 pb-28" : "hidden"} lg:static lg:z-auto lg:block lg:overflow-visible lg:bg-transparent lg:p-0`}
    >
      <div className="mb-5 flex items-center justify-between lg:hidden">
        <h2 className="text-lg font-bold text-ink">Filters</h2>
        <button type="button" onClick={close} className={buttonClass({ variant: "ghost", size: "sm" })}>
          Close
        </button>
      </div>

      <div className="space-y-5">
        <Section title="Monthly rent">
          <div className="flex items-center gap-2">
            <input
              aria-label="Minimum rent"
              inputMode="numeric"
              placeholder="Min"
              value={minText}
              onChange={(e) => {
                setMinText(e.target.value);
                update({ minPrice: numOrNull(e.target.value) }, { debounce: true });
              }}
              className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm focus:border-pine focus:outline-none"
            />
            <span className="text-granite">to</span>
            <input
              aria-label="Maximum rent"
              inputMode="numeric"
              placeholder="Max"
              value={maxText}
              onChange={(e) => {
                setMaxText(e.target.value);
                update({ maxPrice: numOrNull(e.target.value) }, { debounce: true });
              }}
              className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm focus:border-pine focus:outline-none"
            />
          </div>
        </Section>

        <Section title="Bedrooms">
          <div className="flex items-center gap-2">
            <select
              aria-label="Minimum bedrooms"
              value={f.bedsMin?.toString() ?? ""}
              onChange={(e) => update({ bedsMin: e.target.value === "" ? null : Number(e.target.value) })}
              className="h-10 w-full rounded-lg border border-line bg-paper px-2 text-sm focus:border-pine focus:outline-none"
            >
              {BED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "" ? "No min" : o.label}
                </option>
              ))}
            </select>
            <span className="text-granite">to</span>
            <select
              aria-label="Maximum bedrooms"
              value={f.bedsMax?.toString() ?? ""}
              onChange={(e) => update({ bedsMax: e.target.value === "" || e.target.value === "5" ? null : Number(e.target.value) })}
              className="h-10 w-full rounded-lg border border-line bg-paper px-2 text-sm focus:border-pine focus:outline-none"
            >
              {BED_OPTIONS.filter((o) => o.value !== "5").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "" ? "No max" : o.label}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Bathrooms">
          <div className="flex flex-wrap gap-2">
            {[null, 1, 1.5, 2, 3].map((b) => (
              <label
                key={String(b)}
                className="inline-flex cursor-pointer items-center rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink has-checked:border-pine has-checked:bg-pine-wash has-checked:font-semibold has-checked:text-pine-deep has-focus-visible:ring-2 has-focus-visible:ring-pine"
              >
                <input type="radio" name="baths" className="sr-only" checked={f.bathsMin === b} onChange={() => update({ bathsMin: b })} />
                {b === null ? "Any" : `${b}+`}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Move in by">
          <input
            type="date"
            aria-label="Move-in date"
            value={f.moveIn ?? ""}
            onChange={(e) => update({ moveIn: e.target.value || null })}
            className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm focus:border-pine focus:outline-none"
          />
          <p className="text-xs text-granite">Shows places you can move into on or before this date.</p>
        </Section>

        <Section title="Distance from campus">
          <select
            aria-label="Distance from campus"
            value={f.within?.toString() ?? ""}
            onChange={(e) => update({ within: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-10 w-full rounded-lg border border-line bg-paper px-2 text-sm focus:border-pine focus:outline-none"
          >
            <option value="">Any distance</option>
            {DISTANCES.map((d) => (
              <option key={d} value={d}>
                Within {d} {d === 1 ? "mile" : "miles"}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Listing type">
          <div className="flex flex-wrap gap-2">
            {LISTING_TYPES.map((t) => (
              <Chip key={t.value} checked={f.types.includes(t.value)} onChange={(on) => update({ types: toggle<ListingType>(f.types, t.value, on) })}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Property type">
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => (
              <Chip key={t.value} checked={f.properties.includes(t.value)} onChange={(on) => update({ properties: toggle<PropertyType>(f.properties, t.value, on) })}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Amenities">
          <div className="flex flex-wrap gap-2">
            <Chip checked={f.furnished} onChange={(v) => update({ furnished: v })}>
              Furnished
            </Chip>
            <Chip checked={f.parking} onChange={(v) => update({ parking: v })}>
              Parking
            </Chip>
            <Chip checked={f.pets} onChange={(v) => update({ pets: v })}>
              Pets allowed
            </Chip>
          </div>
        </Section>

        {count > 0 && (
          <button type="button" onClick={reset} className="text-sm font-semibold text-pine underline underline-offset-4">
            Clear all filters
          </button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-snow p-4 lg:hidden">
        <button type="button" onClick={close} className={buttonClass({ className: "w-full" })}>
          Show {total.toLocaleString()} {total === 1 ? "place" : "places"}
        </button>
      </div>
    </aside>
  );
}
