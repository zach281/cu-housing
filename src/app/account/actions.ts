"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, type FormState } from "@/lib/validation/auth";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Use 80 characters or fewer."),
  bio: z.string().trim().max(1000, "Keep your bio under 1,000 characters."),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { name: String(formData.get("name") ?? ""), bio: String(formData.get("bio") ?? "") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  // RLS limits this to the caller's own row; column grants limit it to these fields.
  const { error } = await supabase
    .from("profiles")
    .update({ name: parsed.data.name, bio: parsed.data.bio || null })
    .eq("id", user.id);

  if (error) return { status: "error", message: "Your profile didn't save. Try again.", values };

  revalidatePath("/account");
  return { status: "success", message: "Profile saved.", values: parsed.data };
}
