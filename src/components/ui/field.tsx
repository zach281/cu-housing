import type { InputHTMLAttributes, ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
};

export function Field({ label, name, error, hint, id, ...input }: FieldProps) {
  const inputId = id ?? name;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className="block h-12 w-full rounded-lg border border-line bg-paper px-3.5 text-base text-ink placeholder:text-granite/70 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20 aria-[invalid=true]:border-danger"
        {...input}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-granite">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ status, children }: { status: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={status === "error" ? "alert" : "status"}
      className={
        status === "error"
          ? "rounded-lg bg-danger-wash px-4 py-3 text-sm font-medium text-danger"
          : "rounded-lg bg-pine-wash px-4 py-3 text-sm font-medium text-pine-deep"
      }
    >
      {children}
    </div>
  );
}

/**
 * Result of a form submission, shown right above the submit button so it is
 * on screen where the person just clicked. Field-level errors also get a
 * pointer here, since the field itself may be scrolled out of view.
 */
export function FormFeedback({
  state,
}: {
  state: { status: "idle" | "error" | "success"; message?: string; fieldErrors?: Partial<Record<string, string>> };
}) {
  if (state.status === "idle") return null;
  if (state.message) return <FormMessage status={state.status}>{state.message}</FormMessage>;
  const count = Object.values(state.fieldErrors ?? {}).filter(Boolean).length;
  if (state.status === "error" && count > 0) {
    return (
      <FormMessage status="error">
        {count === 1 ? "Fix the highlighted field above." : `Fix the ${count} highlighted fields above.`}
      </FormMessage>
    );
  }
  return null;
}
