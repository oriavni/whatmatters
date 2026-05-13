import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFreshnessForUser } from "@/lib/brief/getCurrentBrief";

export type { FreshnessResult as FreshnessResponse } from "@/lib/brief/getCurrentBrief";

/** GET /api/brief/freshness — lightweight: how many new items since last digest.
 *
 * Still used by BriefContainer for:
 *   - polling freshness while in first-time user "processing" state
 *   - refreshing new-item count after a digest lands
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await getFreshnessForUser(user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
