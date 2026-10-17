"use client";

import { useActionState } from "react";
import { Field, FormFeedback } from "@/components/ui/field";
import { ChoiceCards, SelectField, TextAreaField } from "@/components/ui/form-controls";
import { LISTING_TYPES, PROPERTY_TYPES } from "@/lib/listings/constants";
import { initialFormState, type FormState } from "@/lib/validation/form-state";
import { StepActions } from "../step-actions";

export type StepFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults: Record<string, string | undefined>;
  backHref: string | null;
};

export function BasicsForm({ action, defaults, backHref }: StepFormProps) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (k: string) => state.values?.[k] ?? defaults[k] ?? "";
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <ChoiceCards
        legend="What are you listing?"
        name="listing_type"
        options={LISTING_TYPES}
        defaultValue={v("listing_type")}
        error={fe.listing_type}
      />

      <SelectField
        label="Property type"
        name="property_type"
        placeholder="Choose one"
        options={PROPERTY_TYPES}
        defaultValue={v("property_type")}
        error={fe.property_type}
      />

      <Field
        label="Title"
        name="title"
        defaultValue={v("title")}
        maxLength={120}
        placeholder="Sunny 2-bedroom near the Hill"
        error={fe.title}
        hint="What a student scanning the list should notice first."
      />

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Bedrooms"
          name="bedrooms"
          inputMode="numeric"
          defaultValue={v("bedrooms")}
          error={fe.bedrooms}
          hint="0 for a studio"
        />
        <Field
          label="Bathrooms"
          name="bathrooms"
          inputMode="decimal"
          defaultValue={v("bathrooms")}
          error={fe.bathrooms}
          hint="e.g. 1 or 1.5"
        />
      </div>
      <p className="-mt-3 text-sm text-granite">For a room, give the totals for the whole place.</p>

      <TextAreaField
        label="Description"
        name="description"
        rows={7}
        maxLength={5000}
        defaultValue={v("description")}
        error={fe.description}
        hint="Layout, who lives there, walk time to campus, house rules. At least 30 characters."
      />

      <FormFeedback state={state} />
      <StepActions backHref={backHref} />
    </form>
  );
}
