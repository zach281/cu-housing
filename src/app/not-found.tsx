import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-granite">
        The link may be wrong, or the listing may have been taken down. If it&apos;s one of yours, check My listings.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/browse" className={buttonClass()}>
          Browse housing
        </Link>
        <Link href="/dashboard/listings" className={buttonClass({ variant: "secondary" })}>
          My listings
        </Link>
      </div>
    </div>
  );
}
