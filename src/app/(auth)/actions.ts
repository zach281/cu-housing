"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { safeNextPath } from "@/lib/safe-redirect";
import {
  fieldErrorsFrom,
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
  type FormState,
} from "@/lib/validation/auth";

function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function authErrorMessage(error: AuthError): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (error.code === "weak_password") return "Choose a stronger password: at least 8 characters with letters and numbers.";
  if (error.code === "signup_disabled") return "New sign-ups are paused right now.";
  if (error.code === "email_address_not_authorized") {
    // Supabase's built-in sender only emails project team members; goes away
    // once custom SMTP is configured.
    return "We couldn't send email to that address yet. The site's email service is still being set up.";
  }
  // Logged to the server (visible in Vercel → Logs) and summarized for the user.
  console.error("Supabase auth error", { code: error.code, status: error.status, message: error.message });
  const ref = error.code ?? (error.status ? `status ${error.status}` : error.name);
  return `Something went wrong on our side (${ref}). Try again in a moment.`;
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: text(formData, "name"),
    email: text(formData, "email"),
    intendedRole: text(formData, "intendedRole") || "student",
  };
  const parsed = signUpSchema.safeParse({ ...values, password: text(formData, "password") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const { name, email, password, intendedRole } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, intended_role: intendedRole },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?flow=signup&next=/account`,
    },
  });

  if (error) return { status: "error", message: authErrorMessage(error), values };

  // Same response whether or not the address was already registered, so the
  // form can't be used to discover who has an account.
  return {
    status: "success",
    message: `We sent a confirmation link to ${email}. Open it to finish creating your account.`,
  };
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData, "email") };
  const parsed = signInSchema.safeParse({ ...values, password: text(formData, "password") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      await supabase.auth.resend({
        type: "signup",
        email: parsed.data.email,
        options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm?flow=signup&next=/account` },
      });
      return {
        status: "error",
        message: "Confirm your email before signing in. We just sent you a new link.",
        values,
      };
    }
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { status: "error", message: "That email and password don't match an account.", values };
    }
    return { status: "error", message: authErrorMessage(error), values };
  }

  redirect(safeNextPath(text(formData, "next")));
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?flow=recovery&next=/account/update-password`,
  });
  if (error && error.status === 429) {
    return { status: "error", message: authErrorMessage(error), values };
  }

  // Never reveal whether the address has an account.
  return {
    status: "success",
    message: `If ${parsed.data.email} has an account, a reset link is on its way.`,
  };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/update-password");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: "Choose a password you haven't used here before." } };
    }
    return { status: "error", message: authErrorMessage(error) };
  }

  redirect("/account?updated=password");
}
