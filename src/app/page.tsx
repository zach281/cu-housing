import Link from "next/link";
import { FlatironsRidge } from "@/components/flatirons-ridge";
import { buttonClass } from "@/components/ui/button";

const HOUSING_TYPES = [
  {
    href: "/browse?type=lease",
    title: "Apartments and houses",
    body: "Whole units on a new lease, from studios near Broadway to five-bedroom houses on the Hill.",
  },
  {
    href: "/browse?type=room",
    title: "Rooms",
    body: "A bedroom in a shared place, often with roommates who are already CU students.",
  },
  {
    href: "/browse?type=sublease",
    title: "Subleases and lease takeovers",
    body: "A semester away, an internship, a move: take over someone's place for as long as you need it.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-40 sm:px-6 sm:pt-24 sm:pb-56">
          <h1 className="max-w-3xl text-display font-bold text-ink">Find your next home at CU Boulder.</h1>
          <p className="mt-5 max-w-xl text-lg text-granite sm:text-xl">
            Apartments, rooms, subleases, and roommates, built specifically for CU students.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/browse" className={buttonClass({ size: "lg" })}>
              Find housing
            </Link>
            <Link href="/listings/new" className={buttonClass({ size: "lg", variant: "secondary" })}>
              List a property
            </Link>
          </div>
        </div>
        <FlatironsRidge className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full sm:h-48" />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">What you can find here</h2>
        <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-3">
          {HOUSING_TYPES.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="group block">
                <h3 className="text-lg font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 group-hover:decoration-pine">
                  {t.title}
                </h3>
                <p className="mt-2 text-granite">{t.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-[1fr_1.4fr]">
          <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">How we keep the marketplace honest</h2>
          <div className="space-y-5 text-granite">
            <p>
              <strong className="text-ink">Students verify with their colorado.edu email.</strong> Landlords and
              property managers go through a separate check before they get a provider badge.
            </p>
            <p>
              <strong className="text-ink">Anyone can report a listing or a user.</strong> Reports go to a person
              who reviews them, and listings that break the rules come down.
            </p>
            <p>
              <strong className="text-ink">No money moves through this site.</strong> If someone asks for a deposit
              before you&apos;ve seen the place or signed a lease, stop and report it.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
