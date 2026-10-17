"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";
import type { ListingStatus, StepSlug } from "@/lib/listings/constants";
import { deleteDraft, markUnavailable, relistListing, type ListingActionState } from "./actions";

function Submit({ children, variant = "secondary", pendingText }: { children: React.ReactNode; variant?: "secondary" | "ghost" | "danger"; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass({ variant, size: "sm" })}>
      {pending ? pendingText : children}
    </button>
  );
}

const idle: ListingActionState = { status: "idle" };

export function ListingRowActions({ id, status, resumeStep }: { id: string; status: ListingStatus; resumeStep: StepSlug }) {
  const [unavailableState, unavailableAction] = useActionState(markUnavailable.bind(null, id), idle);
  const [relistState, relistAction] = useActionState(relistListing.bind(null, id), idle);
  const [deleteState, deleteAction] = useActionState(deleteDraft.bind(null, id), idle);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const error = [unavailableState, relistState, deleteState].find((s) => s.status === "error");

  if (status === "removed") return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link href={`/dashboard/listings/${id}/edit/${status === "draft" ? resumeStep : "review"}`} className={buttonClass({ size: "sm" })}>
          {status === "draft" ? "Continue editing" : "Edit"}
        </Link>
        {status === "active" && (
          <form action={unavailableAction}>
            <Submit pendingText="Updating…">Mark unavailable</Submit>
          </form>
        )}
        {status === "unavailable" && (
          <form action={relistAction}>
            <Submit pendingText="Relisting…">Relist</Submit>
          </form>
        )}
        {status === "draft" &&
          (confirmDelete ? (
            <form action={deleteAction} className="flex items-center gap-2">
              <span className="text-sm text-ink">Delete this draft?</span>
              <Submit variant="danger" pendingText="Deleting…">
                Delete
              </Submit>
              <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
                Keep
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass({ variant: "ghost", size: "sm" })}>
              Delete draft
            </button>
          ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error.message}
          {error.problems && (
            <>
              {" "}
              <Link href={`/dashboard/listings/${id}/edit/${error.problems[0].slug}`} className="underline">
                {error.problems[0].problem}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
