"use client";

import { useActionState, useState } from "react";
import { signUp } from "../actions";
import { initialFormState } from "@/lib/validation/auth";
import { Field, FormFeedback, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { isUniversityEmail, site } from "@/lib/site";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initialFormState);
  const [email, setEmail] = useState(state.values?.email ?? "");
  const [role, setRole] = useState(state.values?.intendedRole ?? "student");

  if (state.status === "success") {
    return (
      <div className="space-y-3">
        <FormMessage status="success">{state.message}</FormMessage>
        <p className="text-sm text-granite">
          The link expires in an hour. Can&apos;t find it? Check spam, or sign in and we&apos;ll send a new one.
        </p>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};
  const typedCuEmail = email.includes("@") && isUniversityEmail(email);

  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">I&apos;m here to</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "student", label: "Find housing" },
            { value: "provider", label: "List housing" },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-line bg-paper text-sm font-semibold text-ink has-checked:border-pine has-checked:bg-pine-wash has-checked:text-pine-deep has-focus-visible:ring-2 has-focus-visible:ring-pine"
            >
              <input
                type="radio"
                name="intendedRole"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <p className="text-sm text-granite">Students can list a sublease or room either way.</p>
      </fieldset>

      <Field label="Full name" name="name" autoComplete="name" required defaultValue={state.values?.name} error={fe.name} />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fe.email}
        hint={
          typedCuEmail
            ? "You'll get the CU email verified badge once you confirm this address."
            : role === "student"
              ? `Use your @${site.universityEmailDomain} address to get the CU email verified badge.`
              : undefined
        }
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={fe.password}
        hint="At least 8 characters, with letters and numbers."
      />

      <FormFeedback state={state} />
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
