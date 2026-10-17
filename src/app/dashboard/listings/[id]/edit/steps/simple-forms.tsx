"use client";

import { useActionState } from "react";
import { Field, FormFeedback } from "@/components/ui/field";
import { CheckboxField } from "@/components/ui/form-controls";
import { AMENITIES } from "@/lib/listings/constants";
import { initialFormState } from "@/lib/validation/form-state";
import { StepActions } from "../step-actions";
import type { StepFormProps } from "./basics-form";

const checked = (v: string | undefined) => v === "on" || v === "true";

export function PricingForm({ action, defaults, backHref }: StepFormProps) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (k: string) => state.values?.[k] ?? defaults[k] ?? "";
  // Unchecked boxes are absent from FormData, so after a failed submit trust the submitted values.
  const box = (k: string) => (state.values ? checked(state.values[k]) : checked(defaults[k]));
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="max-w-xs">
        <Field
          label="Monthly rent"
          name="monthly_rent"
          inputMode="numeric"
          placeholder="1200"
          defaultValue={v("monthly_rent")}
          error={fe.monthly_rent}
          hint="In whole dollars. For a room, the rent for that room."
        />
      </div>
      <CheckboxField
        name="utilities_included"
        label="Utilities included"
        description="Water, power, gas and trash are covered by the rent."
        defaultChecked={box("utilities_included")}
      />
      <FormFeedback state={state} />
      <StepActions backHref={backHref} />
    </form>
  );
}

export function AvailabilityForm({
  action,
  defaults,
  backHref,
  endRequired,
  today,
}: StepFormProps & { endRequired: boolean; today: string }) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (k: string) => state.values?.[k] ?? defaults[k] ?? "";
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Move-in date" name="available_date" type="date" min={today} defaultValue={v("available_date")} error={fe.available_date} />
        <Field
          label={endRequired ? "Lease end date" : "Lease end date (optional)"}
          name="lease_end_date"
          type="date"
          min={today}
          defaultValue={v("lease_end_date")}
          error={fe.lease_end_date}
          hint={endRequired ? "When the sublease or lease ends." : "Leave blank if it's open-ended or month to month."}
        />
      </div>
      <FormFeedback state={state} />
      <StepActions backHref={backHref} />
    </form>
  );
}

export function AmenitiesForm({ action, defaults, backHref }: StepFormProps) {
  const [state, formAction] = useActionState(action, initialFormState);
  const box = (k: string) => (state.values ? checked(state.values[k]) : checked(defaults[k]));

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        {AMENITIES.map((a) => (
          <CheckboxField key={a.key} name={a.key} label={a.label} defaultChecked={box(a.key)} />
        ))}
      </div>
      <p className="text-sm text-granite">Utilities are set on the Pricing step.</p>
      <FormFeedback state={state} />
      <StepActions backHref={backHref} />
    </form>
  );
}
