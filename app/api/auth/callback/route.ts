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
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` lets a caller specify where to go after auth (e.g. deep link)
  const next = searchParams.get("next") ?? "/app/brief";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Use the origin from the request so this works behind proxies / on any domain
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — land on an error page
  return NextResponse.redirect(`${origin}/auth-error`);
}
