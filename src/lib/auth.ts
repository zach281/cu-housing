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

type AuthState =
  | { kind: "signed_out" }
  | { kind: "no_profile" } // valid session, but the account has no profile row
  | { kind: "signed_in"; user: CurrentUser };

const PROFILE_COLUMNS =
  "id, name, role, bio, profile_photo_path, verification_status, account_status, created_at";

async function readAuthState(): Promise<AuthState> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { kind: "signed_out" };

  let { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();

  if (!profile) {
    // Profiles are created by a database trigger at sign-up. Accounts made
    // before that trigger existed have none; ask the database to build it.
    // (It returns the row: re-reading would hit Next's per-request fetch
    // memoization and return the stale empty result.)
    const { data: repaired, error: repairError } = await supabase.rpc("ensure_my_profile");
    if (repairError) console.error("ensure_my_profile failed", repairError);
    profile = repaired?.id ? repaired : null;
  }
  if (!profile) return { kind: "no_profile" };

  return {
    kind: "signed_in",
    user: {
      id: user.id,
      email: user.email ?? "",
      emailConfirmed: Boolean(user.email_confirmed_at),
      profile: { ...profile, verification_status: profile.verification_status ?? "unverified" },
    },
  };
}

/**
 * The signed-in user, or null. Uses getUser(), which validates the session
 * with Supabase Auth, so it is safe for authorization decisions on the server.
 * Must be called inside a <Suspense> boundary (it reads cookies).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await readAuthState();
  return state.kind === "signed_in" ? state.user : null;
}

/**
 * Like getCurrentUser, but sends signed-out visitors to /login. A session
 * without a usable profile goes to an explanation page instead, so it can't
 * loop between /login and the protected page.
 */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const state = await readAuthState();
  if (state.kind === "signed_out") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (state.kind === "no_profile") redirect("/auth/error?reason=profile");
  return state.user;
}
