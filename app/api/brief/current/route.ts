import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBriefForUser } from "@/lib/brief/getCurrentBrief";

/** GET /api/brief/current — returns the latest digest for the authenticated user.
 *
 * Used by BriefContainer for:
 *   - polling while generation is in progress
 *   - re-fetching after the user clicks "Read now"
 *
 * The initial page load uses SSR (BriefPage) instead, so this route is only
 * hit after the page is already mounted.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await getCurrentBriefForUser(user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
