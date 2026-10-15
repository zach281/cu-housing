"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../actions";
import { initialFormState } from "@/lib/validation/auth";
import { Field, FormFeedback } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initialFormState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={fe.email}
      />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required error={fe.password} />

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-semibold text-pine underline underline-offset-4">
          Forgot your password?
        </Link>
      </div>

      <FormFeedback state={state} />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
