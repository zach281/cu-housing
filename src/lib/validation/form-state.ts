/** Result of a form server action, rendered by the form that submitted it. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
