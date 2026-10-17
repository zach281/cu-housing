import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Companions to <Field>: same label / hint / error layout and accessibility wiring.

const controlClass =
  "block w-full rounded-lg border border-line bg-paper px-3.5 text-base text-ink placeholder:text-granite/70 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20 aria-[invalid=true]:border-danger";

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

function Shell({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="font-normal text-granite"> (optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-granite">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  error,
  optional,
  id,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string; hint?: ReactNode; error?: string; optional?: boolean }) {
  const inputId = id ?? name;
  return (
    <Shell id={inputId} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        className={`${controlClass} py-3`}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  name,
  hint,
  error,
  options,
  placeholder,
  id,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  const inputId = id ?? name;
  return (
    <Shell id={inputId} label={label} hint={hint} error={error}>
      <select
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        className={`${controlClass} h-12 pr-10`}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

export function CheckboxField({
  label,
  name,
  description,
  defaultChecked,
}: {
  label: string;
  name: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-paper p-4 has-checked:border-pine has-checked:bg-pine-wash">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 shrink-0 accent-pine" />
      <span>
        <span className="block font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-granite">{description}</span>}
      </span>
    </label>
  );
}

/** Radio group drawn as tappable cards. */
export function ChoiceCards({
  legend,
  name,
  options,
  defaultValue,
  error,
  columns = 2,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string; hint?: string }[];
  defaultValue?: string | null;
  error?: string;
  columns?: 2 | 4;
}) {
  return (
    <fieldset className="space-y-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div className={`grid grid-cols-1 gap-2 ${columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer flex-col rounded-lg border border-line bg-paper p-3.5 has-checked:border-pine has-checked:bg-pine-wash has-focus-visible:ring-2 has-focus-visible:ring-pine"
          >
            <span className="flex items-center gap-2">
              <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} className="h-4 w-4 accent-pine" />
              <span className="font-semibold text-ink">{o.label}</span>
            </span>
            {o.hint && <span className="mt-1 pl-6 text-sm text-granite">{o.hint}</span>}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
