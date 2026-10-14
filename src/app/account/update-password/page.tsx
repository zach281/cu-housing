"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/(auth)/actions";
import { initialFormState } from "@/lib/validation/auth";
import { Field, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

// Reached from the account page, or from a password-reset email (the
// /auth/confirm route signs the user in first). The proxy and the server
// action both require a session.
export default function UpdatePasswordPage() {
  const [state, action] = useActionState(updatePassword, initialFormState);
  const fe = state.fieldErrors ?? {};

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Choose a new password</h1>
      <form action={action} className="mt-8 space-y-5" noValidate>
        {state.status === "error" && state.message && <FormMessage status="error">{state.message}</FormMessage>}
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          error={fe.password}
          hint="At least 8 characters, with letters and numbers."
        />
        <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required error={fe.confirm} />
        <SubmitButton pendingText="Updating…">Update password</SubmitButton>
      </form>
    </div>
  );
}
