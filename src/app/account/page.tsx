import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { isUniversityEmail, site } from "@/lib/site";
import { VerificationBadge } from "@/components/verification-badge";
import { buttonClass } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<p className="text-granite">Loading your account…</p>}>
        <AccountDetails searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const ROLE_LABEL = { student: "Student", provider: "Housing provider", admin: "Admin" } as const;

async function AccountDetails({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const user = await requireUser("/account");
  const { updated } = await searchParams;
  const { profile } = user;

  return (
    <>
      {updated === "password" && (
        <div className="mb-6">
          <FormMessage status="success">Password updated.</FormMessage>
        </div>
      )}

      {profile.account_status === "suspended" && (
        <div className="mb-6">
          <FormMessage status="error">
            Your account is suspended. You can&apos;t post listings or send messages until a moderator reviews it.
          </FormMessage>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{profile.name || "Your account"}</h1>
        <VerificationBadge status={profile.verification_status} />
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-granite">Email</dt>
        <dd className="break-all text-ink">{user.email}</dd>
        <dt className="text-granite">Account type</dt>
        <dd className="text-ink">{ROLE_LABEL[profile.role]}</dd>
      </dl>

      <VerificationExplainer status={profile.verification_status} role={profile.role} email={user.email} />

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-xl font-bold text-ink">Profile</h2>
        <p className="mt-1 text-sm text-granite">Shown to people you contact and on listings you post.</p>
        <div className="mt-6">
          <ProfileForm name={profile.name} bio={profile.bio ?? ""} />
        </div>
      </section>

      <section className="mt-10 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row">
        <Link href="/account/update-password" className={buttonClass({ variant: "secondary" })}>
          Change password
        </Link>
        <form action="/auth/signout" method="post">
          <button type="submit" className={buttonClass({ variant: "ghost", className: "w-full sm:w-auto" })}>
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}

function VerificationExplainer({
  status,
  role,
  email,
}: {
  status: string;
  role: string;
  email: string;
}) {
  if (status === "unverified" && role !== "provider") {
    return (
      <p className="mt-6 rounded-lg border border-line bg-paper p-4 text-sm text-granite">
        {isUniversityEmail(email)
          ? "Confirm your email to get the CU email verified badge."
          : `Accounts that sign up with a @${site.universityEmailDomain} address get the CU email verified badge, which helps listing owners know they're talking to a student.`}
      </p>
    );
  }
  if (role === "provider" && (status === "unverified" || status === "cu_verified")) {
    return (
      <p className="mt-6 rounded-lg border border-line bg-paper p-4 text-sm text-granite">
        Provider verification is done by our team. Until then, your listings show without a provider badge.
      </p>
    );
  }
  return null;
}
