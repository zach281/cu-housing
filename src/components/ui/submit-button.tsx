"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "./button";

export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass({ size: "lg", className: "w-full" })}>
      {pending ? pendingText : children}
    </button>
  );
}
