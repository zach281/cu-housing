import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

// Server client bound to the signed-in user's session cookies. Queries run as
// that user, so RLS still applies. Create a new one per request.
export async function createClient() {
  // Everything read through this client is per-user and time-sensitive (the
  // auth library checks token expiry with Date.now()), so never prerender it.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
