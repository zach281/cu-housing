import type { Enums } from "@/lib/supabase/database.types";

const LABELS: Record<Enums<"verification_status">, string | null> = {
  unverified: null,
  cu_verified: "CU email verified",
  provider_verified: "Verified provider",
  admin_verified: "Verified by staff",
};

// Wording describes what was checked, never that someone is "safe".
export function VerificationBadge({ status }: { status: Enums<"verification_status"> }) {
  const label = LABELS[status];
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-alpenglow-wash px-2.5 py-1 text-xs font-semibold text-ink">
      <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 fill-alpenglow">
        <path d="M8 0l2.1 1.6 2.6-.2.8 2.5 2.2 1.5-.9 2.5.9 2.5-2.2 1.5-.8 2.5-2.6-.2L8 16l-2.1-1.6-2.6.2-.8-2.5L.3 10.6l.9-2.5-.9-2.5 2.2-1.5.8-2.5 2.6.2z" />
        <path d="M6.9 10.6L4.6 8.3l1-1 1.3 1.3 3.5-3.5 1 1z" className="fill-ink" />
      </svg>
      {label}
    </span>
  );
}
