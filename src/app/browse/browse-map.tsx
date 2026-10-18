"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { CAMPUS, formatRent, formatBeds } from "@/lib/listings/constants";

export type MapListing = { id: string; title: string; rent: number; bedrooms: number; lat: number; lng: number };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Browse map. Pins use each listing's approximate location (snapped to a
 * ~250 m grid), so they show the area, not the front door.
 */
export function BrowseMap({ listings }: { listings: MapListing[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const key = listings.map((l) => l.id).join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map.current?.remove();
      const m = L.map(el.current, { scrollWheelZoom: false }).setView(CAMPUS, 13);
      map.current = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);

      L.marker(CAMPUS, {
        icon: L.divIcon({
          className: "",
          html: '<span style="display:block;padding:2px 6px;border-radius:6px;background:#16201c;color:#fff;font:600 11px/1.4 var(--font-schibsted),sans-serif;white-space:nowrap">CU campus</span>',
          iconAnchor: [34, 10],
        }),
        keyboard: false,
        interactive: false,
      }).addTo(m);

      // Several listings can share a snapped location; nudge them apart slightly.
      const seen = new Map<string, number>();
      const points: [number, number][] = [];
      for (const l of listings) {
        const k = `${l.lat},${l.lng}`;
        const n = seen.get(k) ?? 0;
        seen.set(k, n + 1);
        const angle = n * 2.4;
        const lat = l.lat + (n ? Math.sin(angle) * 0.0004 * Math.sqrt(n) : 0);
        const lng = l.lng + (n ? Math.cos(angle) * 0.0005 * Math.sqrt(n) : 0);
        points.push([lat, lng]);
        L.marker([lat, lng], {
          title: `${formatRent(l.rent)}/mo, ${l.title}`,
          icon: L.divIcon({
            className: "",
            html: `<span style="display:inline-block;transform:translate(-50%,-100%);padding:3px 8px;border-radius:999px;background:#1f4e3d;color:#fff;font:700 12px/1.4 var(--font-schibsted),sans-serif;white-space:nowrap;box-shadow:0 1px 3px rgba(22,32,28,.35);border:1.5px solid #fff">${esc(formatRent(l.rent))}</span>`,
            iconSize: [0, 0],
          }),
        })
          .bindPopup(
            `<strong style="font-size:14px">${esc(formatRent(l.rent))}/mo</strong><br>${esc(l.title)}<br><span style="color:#5f6a65">${esc(formatBeds(l.bedrooms))}</span>`,
          )
          .addTo(m);
      }
      if (points.length) m.fitBounds(L.latLngBounds([...points, [CAMPUS.lat, CAMPUS.lng]]), { padding: [40, 40], maxZoom: 15 });
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild only when the set of listings changes
  }, [key]);

  return (
    <div className="space-y-2">
      <div
        ref={el}
        role="application"
        aria-label={`Map of ${listings.length} listings around CU Boulder`}
        className="relative z-0 h-[65vh] min-h-[22rem] w-full overflow-hidden rounded-xl border border-line bg-pine-wash"
      />
      <p className="text-xs text-granite">Pins show the approximate area of each listing, not the exact address.</p>
    </div>
  );
}
