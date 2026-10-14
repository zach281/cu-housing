import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-granite">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-pine underline underline-offset-4">
          Create an account
        </Link>
      </p>
      <div className="mt-8">
        {/* searchParams is request data, so it resolves behind a boundary. */}
        <Suspense fallback={<LoginForm next="/account" />}>
          <LoginFormWithNext searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function LoginFormWithNext({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next)} />;
}
