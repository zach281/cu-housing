import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Create an account</h1>
      <p className="mt-2 text-granite">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-pine underline underline-offset-4">
          Sign in
        </Link>
      </p>
      <div className="mt-8">
        <SignUpForm />
      </div>
    </>
  );
}
