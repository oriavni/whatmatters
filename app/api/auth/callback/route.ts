import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback
 *
 * Handles two Supabase auth flows that redirect back here:
 *   1. OAuth (Google) — exchanges the `code` for a session
 *   2. Email confirmation / magic link — same code-exchange mechanism
 *
 * After a successful exchange the user is redirected to /app/brief.
 * On failure they land on /auth-error.
 *
 * Redirect base URL:
 *   We prefer NEXT_PUBLIC_APP_URL (set on Vercel per-environment) over the
 *   request origin so that Vercel preview-deployment URLs never appear inside
 *   the OAuth redirect chain.  When running locally NEXT_PUBLIC_APP_URL is
 *   typically unset, so we fall back to `origin` which is always correct in
 *   that context.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` lets a caller specify where to go after auth (e.g. deep link)
  const next = searchParams.get("next") ?? "/app/brief";

  // Prefer the canonical app URL so Vercel preview URLs never leak into
  // the redirect chain (e.g. when the OAuth app is registered against the
  // production domain).  Falls back to the request origin for local dev.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  // Something went wrong — land on an error page
  return NextResponse.redirect(`${baseUrl}/auth-error`);
}
