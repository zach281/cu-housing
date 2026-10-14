import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Pick<
  Tables<"profiles">,
  "id" | "name" | "role" | "bio" | "profile_photo_path" | "account_status" | "created_at"
> & {
  // Computed column: always set in practice, typed nullable by the generator.
  verification_status: NonNullable<Tables<"profiles">["verification_status"]>;
};

export type CurrentUser = {
  id: string;
  email: string;
  emailConfirmed: boolean;
  profile: Profile;
};

/**
 * The signed-in user, or null. Uses getUser(), which validates the session
 * with Supabase Auth, so it is safe for authorization decisions on the server.
 * Must be called inside a <Suspense> boundary (it reads cookies).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role, bio, profile_photo_path, verification_status, account_status, created_at")
    .eq("id", user.id)
    .single();

  if (!profile) return null; // profile is created by a DB trigger; absence means a broken account

  return {
    id: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    profile: { ...profile, verification_status: profile.verification_status ?? "unverified" },
  };
}

/** Like getCurrentUser, but sends signed-out visitors to /login. */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
