import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

// Lands here from links in auth emails. Two link styles are supported:
//
//  ?token_hash=…&type=…  Custom templates (supabase/templates/). Works on any
//                        device: the token itself proves the email.
//  ?code=…               Supabase's default templates. Supabase has already
//                        verified the email before sending the user here; the
//                        code then signs them in, but only in the browser that
//                        started the flow (PKCE).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const flow = searchParams.get("flow");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));

  // Supabase rejected the link itself (expired, already used).
  if (searchParams.get("error") || searchParams.get("error_code")) {
    return to("/auth/error");
  }

  const supabase = await createClient();

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return to(error ? "/auth/error" : next);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to(next);

    // Opened on a different device or browser than the one used to sign up.
    // The email is confirmed regardless; they just need to sign in here.
    if (flow === "signup") return to(`/login?confirmed=1&next=${encodeURIComponent(next)}`);
    if (flow === "recovery") return to("/auth/error?reason=device");
  }

  return to("/auth/error");
}
