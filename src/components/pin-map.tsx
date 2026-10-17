"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { CAMPUS } from "@/lib/listings/constants";

type LatLng = { lat: number; lng: number };

// Pin drawn in SVG (Leaflet's default marker images don't survive bundling).
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" aria-hidden="true">
  <path d="M16 41s14-13.6 14-25A14 14 0 0 0 2 16c0 11.4 14 25 14 25z" fill="#1f4e3d" stroke="#fff" stroke-width="2"/>
  <circle cx="16" cy="16" r="5" fill="#fff"/></svg>`;

/**
 * OpenStreetMap with one draggable pin. Clicking the map moves the pin too.
 * Leaflet touches `window`, so it's imported only in the browser.
 */
export function PinMap({
  value,
  onChange,
  label,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView(value ?? CAMPUS, value ? 16 : 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      const icon = L.divIcon({ html: PIN_SVG, className: "", iconSize: [32, 42], iconAnchor: [16, 41] });
      const place = (p: LatLng) => {
        if (!marker.current) {
          marker.current = L.marker(p, { draggable: true, icon, keyboard: true, title: "Listing location" }).addTo(m);
          marker.current.on("dragend", () => {
            const ll = marker.current!.getLatLng();
            onChangeRef.current({ lat: round(ll.lat), lng: round(ll.lng) });
          });
        } else marker.current.setLatLng(p);
      };
      if (value) place(value);
      m.on("click", (e) => {
        const p = { lat: round(e.latlng.lat), lng: round(e.latlng.lng) };
        place(p);
        onChangeRef.current(p);
      });
      map.current = m;
      (m as LeafletMap & { _place?: typeof place })._place = place;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once; updates handled below
  }, []);

  // Follow external changes (e.g. an address lookup).
  useEffect(() => {
    const m = map.current as (LeafletMap & { _place?: (p: LatLng) => void }) | null;
    if (!m || !value) return;
    const cur = marker.current?.getLatLng();
    if (cur && Math.abs(cur.lat - value.lat) < 1e-6 && Math.abs(cur.lng - value.lng) < 1e-6) return;
    m._place?.(value);
    m.setView(value, Math.max(m.getZoom(), 16));
  }, [value]);

  return (
    <div
      ref={el}
      role="application"
      aria-label={label}
      className="relative z-0 h-72 w-full overflow-hidden rounded-lg border border-line bg-pine-wash sm:h-80"
    />
  );
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
