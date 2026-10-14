import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-granite sm:px-6">
        <p className="max-w-prose">
          Verification badges confirm an email address or a provider check, not that a listing is safe.
          See the place, read the lease, and confirm who you&apos;re dealing with before you send any money.
        </p>
        <p>
          {site.name} is an independent marketplace and is not affiliated with the University of Colorado.
        </p>
      </div>
    </footer>
  );
}
