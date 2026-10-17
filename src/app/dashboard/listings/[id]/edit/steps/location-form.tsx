"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, FormFeedback, FormMessage } from "@/components/ui/field";
import { PinMap } from "@/components/pin-map";
import { buttonClass } from "@/components/ui/button";
import { BOULDER_NEIGHBORHOODS, CAMPUS, MAX_MILES_FROM_CAMPUS, milesBetween } from "@/lib/listings/constants";
import { initialFormState } from "@/lib/validation/form-state";
import { lookupAddress } from "../../../actions";
import { StepActions } from "../step-actions";
import type { StepFormProps } from "./basics-form";

type LatLng = { lat: number; lng: number };

export function LocationForm({ action, defaults, backHref }: StepFormProps) {
  const [state, formAction] = useActionState(action, initialFormState);
  const initialLat = Number(state.values?.latitude ?? defaults.latitude);
  const initialLng = Number(state.values?.longitude ?? defaults.longitude);

  const [address, setAddress] = useState(state.values?.address ?? defaults.address ?? "");
  const [point, setPoint] = useState<LatLng | null>(
    Number.isFinite(initialLat) && Number.isFinite(initialLng) && (initialLat || initialLng) ? { lat: initialLat, lng: initialLng } : null,
  );
  const [lookup, setLookup] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [searching, startSearch] = useTransition();

  const find = () =>
    startSearch(async () => {
      setLookup(null);
      const r = await lookupAddress(address);
      if (r.ok) {
        setPoint({ lat: r.lat, lng: r.lng });
        setLookup({ kind: "ok", text: `Found ${r.matchedAddress || "the address"}, ${r.miles.toFixed(1)} miles from campus. Drag the pin if it's not quite right.` });
      } else if (r.reason === "too_far") {
        setLookup({ kind: "error", text: `That address is ${r.miles?.toFixed(0)} miles from campus. Listings must be within ${MAX_MILES_FROM_CAMPUS} miles of CU Boulder.` });
      } else if (r.reason === "not_found") {
        setLookup({ kind: "error", text: "We couldn't find that address. Check the street number and name, or click the map to drop a pin." });
      } else if (r.reason === "invalid") {
        setLookup({ kind: "error", text: "Enter the full street address first." });
      } else {
        setLookup({ kind: "error", text: "The address lookup isn't responding right now. Click the map to drop a pin instead." });
      }
    });

  const miles = point ? milesBetween(CAMPUS, point) : null;
  // Hide errors the poster has already fixed since submitting.
  const submitted = state.values;
  const fe = { ...(state.fieldErrors ?? {}) };
  if (submitted && address !== submitted.address) delete fe.address;
  if (point && (String(point.lat) !== submitted?.latitude || String(point.lng) !== submitted?.longitude)) {
    delete fe.latitude;
    delete fe.longitude;
    if (fe.address?.includes("miles of CU Boulder")) delete fe.address;
  }
  const feedback = Object.keys(fe).length === Object.keys(state.fieldErrors ?? {}).length ? state : { ...state, fieldErrors: fe };

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Field
              label="Street address"
              name="address"
              autoComplete="street-address"
              placeholder="1100 College Ave, Boulder, CO 80302"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  find();
                }
              }}
              error={fe.address}
              hint="Include the unit number if there is one. Boulder, CO is assumed if you leave it off."
            />
          </div>
          <button
            type="button"
            onClick={find}
            disabled={searching}
            className={buttonClass({ variant: "secondary", className: "sm:mt-[1.75rem]" })}
          >
            {searching ? "Finding…" : "Find on map"}
          </button>
        </div>
        {lookup && <FormMessage status={lookup.kind === "ok" ? "success" : "error"}>{lookup.text}</FormMessage>}
      </div>

      <div className="space-y-2">
        <PinMap value={point} onChange={setPoint} label="Map: click to place the listing pin, or drag the pin to adjust it" />
        <p className="text-sm text-granite">
          {point
            ? `Pin placed ${miles!.toFixed(1)} miles from Norlin Library.`
            : "No pin yet. Find the address, or click the map where the place is."}
        </p>
        {(fe.latitude || fe.longitude) && <p className="text-sm font-medium text-danger">{fe.latitude ?? fe.longitude}</p>}
      </div>
      <input type="hidden" name="latitude" value={point?.lat ?? ""} />
      <input type="hidden" name="longitude" value={point?.lng ?? ""} />

      <div>
        <Field
          label="Neighborhood (optional)"
          name="neighborhood"
          list="neighborhoods"
          maxLength={80}
          defaultValue={state.values?.neighborhood ?? defaults.neighborhood ?? ""}
          error={fe.neighborhood}
          hint="Helps students who search by area."
        />
        <datalist id="neighborhoods">
          {BOULDER_NEIGHBORHOODS.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      <FormFeedback state={feedback} />
      <StepActions backHref={backHref} />
    </form>
  );
}
