import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Link didn't work" };

export default function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-ink">That link didn&apos;t work</h1>
      <Suspense fallback={<Explanation reason={undefined} />}>
        <ExplanationFromParams searchParams={searchParams} />
      </Suspense>
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

async function ExplanationFromParams({ searchParams }: { searchParams: PageProps<"/auth/error">["searchParams"] }) {
  const { reason } = await searchParams;
  return <Explanation reason={typeof reason === "string" ? reason : undefined} />;
}

function Explanation({ reason }: { reason: string | undefined }) {
  if (reason === "profile") {
    return (
      <p className="mt-3 text-granite">
        You&apos;re signed in, but your account&apos;s profile couldn&apos;t be loaded. This happens when an account was
        created before the site&apos;s database was fully set up. Contact the site admin to repair it.
      </p>
    );
  }
  if (reason === "device") {
    return (
      <p className="mt-3 text-granite">
        Password reset links only work in the browser where you requested them. Open the link on that device, or
        request a new reset link here.
      </p>
    );
  }
  return (
    <p className="mt-3 text-granite">
      Email links expire after an hour and can only be used once. Sign in to get a new confirmation link, or request a
      new password reset.
    </p>
  );
}
