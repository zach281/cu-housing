"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";
import { initialFormState } from "@/lib/validation/auth";
import { Field, FormFeedback } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { useFormStatus } from "react-dom";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass()}>
      {pending ? "Saving…" : "Save profile"}
    </button>
  );
}

export function ProfileForm({ name, bio }: { name: string; bio: string }) {
  const [state, action] = useActionState(updateProfile, initialFormState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field label="Name" name="name" autoComplete="name" required defaultValue={state.values?.name ?? name} error={fe.name} />
      <div className="space-y-1.5">
        <label htmlFor="bio" className="block text-sm font-semibold text-ink">
          Bio <span className="font-normal text-granite">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={1000}
          defaultValue={state.values?.bio ?? bio}
          aria-invalid={fe.bio ? true : undefined}
          aria-describedby={fe.bio ? "bio-error" : undefined}
          className="block w-full rounded-lg border border-line bg-paper px-3.5 py-3 text-base text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
          placeholder="Year, major, what you're looking for"
        />
        {fe.bio && (
          <p id="bio-error" className="text-sm font-medium text-danger">
            {fe.bio}
          </p>
        )}
      </div>
      <FormFeedback state={state} />
      <SaveButton />
    </form>
  );
}
