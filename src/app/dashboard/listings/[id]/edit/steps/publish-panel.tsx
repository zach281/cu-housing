"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { STEPS } from "@/lib/listings/constants";
import type { ListingActionState } from "../../../actions";

function PublishButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass({ size: "lg", className: "w-full sm:w-auto" })}>
      {pending ? "Publishing…" : label}
    </button>
  );
}

export function PublishPanel({
  action,
  listingId,
  label,
  ready,
}: {
  action: () => Promise<ListingActionState>;
  listingId: string;
  label: string;
  ready: boolean;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" } as ListingActionState);
  const labelFor = (slug: string) => STEPS.find((s) => s.slug === slug)?.label ?? slug;

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && (
        <FormMessage status="error">
          {state.message}
          {state.problems && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {state.problems.map((p) => (
                <li key={p.slug}>
                  <Link href={`/dashboard/listings/${listingId}/edit/${p.slug}`} className="underline">
                    {labelFor(p.slug)}
                  </Link>
                  : {p.problem}
                </li>
              ))}
            </ul>
          )}
        </FormMessage>
      )}
      <p className="text-sm text-granite">
        {ready
          ? "Publishing makes this listing visible to everyone browsing the site. You can edit it or mark it unavailable at any time."
          : "Finish the steps marked above to publish. Your progress is saved as a draft."}
      </p>
      <PublishButton label={label} />
    </form>
  );
}
