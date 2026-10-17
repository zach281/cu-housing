"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";

/** Back / Save and exit / Save and continue, shared by every step form. */
export function StepActions({ backHref, continueLabel = "Save and continue" }: { backHref: string | null; continueLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      {backHref ? (
        <Link href={backHref} className={buttonClass({ variant: "ghost" })}>
          Back
        </Link>
      ) : (
        <span />
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button type="submit" name="intent" value="exit" disabled={pending} className={buttonClass({ variant: "secondary" })}>
          Save and exit
        </button>
        <button type="submit" name="intent" value="continue" disabled={pending} className={buttonClass()}>
          {pending ? "Saving…" : continueLabel}
        </button>
      </div>
    </div>
  );
}
