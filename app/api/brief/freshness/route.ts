import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface FreshnessResponse {
  /** Items created after the last digest (or all items if no digest yet) */
  newCount: number;
  /** ISO timestamp of the most recent digest, or null */
  lastDigestAt: string | null;
}

/** GET /api/brief/freshness — lightweight check: how many new items exist since last digest */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Find the latest digest that actually completed (ready or sent)
  const { data: lastDigest } = await service
    .from("digests")
    .select("created_at")
    .eq("user_id", user.id)
    .in("status", ["ready", "sent"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastDigestAt = lastDigest?.created_at ?? null;

  // Count raw items created after the last digest (or all items if first time)
  let query = service
    .from("raw_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (lastDigestAt) {
    query = query.gt("created_at", lastDigestAt);
  }

  const { count } = await query;

  return NextResponse.json({
    newCount: count ?? 0,
    lastDigestAt,
  } satisfies FreshnessResponse);
}
