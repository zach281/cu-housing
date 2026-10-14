"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { initialFormState } from "@/lib/validation/auth";
import { Field, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Reset your password</h1>
      <p className="mt-2 text-granite">We&apos;ll email you a link to choose a new one.</p>
      <div className="mt-8">
        {state.status === "success" ? (
          <FormMessage status="success">{state.message}</FormMessage>
        ) : (
          <form action={action} className="space-y-5" noValidate>
            {state.status === "error" && state.message && <FormMessage status="error">{state.message}</FormMessage>}
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={state.values?.email}
              error={state.fieldErrors?.email}
            />
            <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
          </form>
        )}
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-semibold text-pine underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </>
  );
}
