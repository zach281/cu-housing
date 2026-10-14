import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Link expired" };

export default function AuthErrorPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-ink">That link didn&apos;t work</h1>
      <p className="mt-3 text-granite">
        Email links expire after an hour and can only be used once. Sign in to get a new confirmation link, or
        request a new password reset.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/login" className={buttonClass()}>
          Sign in
        </Link>
        <Link href="/forgot-password" className={buttonClass({ variant: "secondary" })}>
          Reset password
        </Link>
      </div>
    </div>
  );
}
