import Link from "next/link";
import { Suspense } from "react";
import { site } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth";
import { buttonClass } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">
          {site.name}
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link href="/browse" className="hidden rounded-md px-3 py-2 text-sm font-medium text-granite hover:text-ink sm:block">
            Browse housing
          </Link>
          {/* Session-dependent UI streams in; the rest of the header is static. */}
          <Suspense fallback={<div className="h-9 w-20" aria-hidden />}>
            <UserNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function UserNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-pine-wash">
          Sign in
        </Link>
        <Link href="/signup" className={buttonClass({ size: "sm" })}>
          Sign up
        </Link>
      </div>
    );
  }

  const firstName = user.profile.name.split(" ")[0] || "Account";
  return (
    <Link href="/account" className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-pine-wash">
      {firstName}
    </Link>
  );
}
