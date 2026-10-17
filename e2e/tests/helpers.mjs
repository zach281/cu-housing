// Shared helpers for end-to-end tests against the local stack (e2e/stack).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Use the app's own copy of supabase-js so tests exercise the same version.
const require = createRequire(new URL("../../package.json", import.meta.url));
export const { createClient } = require("@supabase/supabase-js");

export const SUPABASE_URL = "http://localhost:54321";
export const PUBLISHABLE_KEY = "sb_publishable_local_test_key";
export const APP_URL = process.env.APP_URL ?? "http://localhost:3100";
export const OUTBOX = process.env.OUTBOX_DIR ?? "/var/tmp/cu-housing-stack/outbox";

export const client = () =>
  createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export const uniqueEmail = (domain = "colorado.edu") =>
  `test.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@${domain}`;

/** Waits for the newest email sent to `to` and returns its decoded body. */
export async function waitForEmail(to, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = fs.readdirSync(OUTBOX).filter((f) => f.endsWith(`-${to}.eml`)).sort();
    if (files.length) {
      const raw = fs.readFileSync(path.join(OUTBOX, files.at(-1)), "utf8");
      // Undo quoted-printable soft breaks and =XX escapes.
      return raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No email to ${to} within ${timeoutMs}ms`);
}

export function firstLink(emailBody) {
  const m = emailBody.match(/href="([^"]+)"/);
  if (!m) throw new Error("No link in email");
  return m[1].replace(/&amp;/g, "&");
}

/** Creates a confirmed user via the real sign-up + email confirmation flow. */
export async function createConfirmedUser({ email = uniqueEmail(), password = "buffs2027", name = "Test Buff", intendedRole = "student" } = {}) {
  const sb = client();
  const { error } = await sb.auth.signUp({ email, password, options: { data: { name, intended_role: intendedRole } } });
  if (error) throw error;
  const link = firstLink(await waitForEmail(email));
  const r = await fetch(link, { redirect: "manual" });
  if (r.status !== 303 && r.status !== 302) throw new Error(`verify link returned ${r.status}`);
  const signedIn = client();
  const { data, error: e2 } = await signedIn.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { email, password, user: data.user, sb: signedIn };
}
