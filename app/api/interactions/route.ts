import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/interactions?cluster_ids=id1,id2,...
 *
 * Returns the current user's interaction state for a set of clusters:
 *   liked   — cluster_ids with a thumbs_up row in feedback_events
 *   saved   — cluster_ids present in saved_items
 *   ignored — cluster_ids with a skip row in feedback_events
 *
 * All three use feedback_events or saved_items as source of truth,
 * matching exactly what the write path (/api/feedback) writes.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const param = searchParams.get("cluster_ids") ?? "";
  const clusterIds = param.split(",").map((s) => s.trim()).filter(Boolean);

  if (clusterIds.length === 0) {
    return NextResponse.json({ liked: [], saved: [], ignored: [] });
  }

  const service = createServiceClient();

  const [likedResult, savedResult, ignoredResult] = await Promise.all([
    service
      .from("feedback_events")
      .select("cluster_id")
      .eq("user_id", user.id)
      .eq("type", "thumbs_up")
      .in("cluster_id", clusterIds),

    service
      .from("saved_items")
      .select("cluster_id")
      .eq("user_id", user.id)
      .in("cluster_id", clusterIds),

    service
      .from("feedback_events")
      .select("cluster_id")
      .eq("user_id", user.id)
      .eq("type", "skip")
      .in("cluster_id", clusterIds),
  ]);

  const liked = (likedResult.data ?? [])
    .map((r) => r.cluster_id)
    .filter(Boolean) as string[];

  const saved = (savedResult.data ?? [])
    .map((r) => r.cluster_id)
    .filter(Boolean) as string[];

  const ignored = (ignoredResult.data ?? [])
    .map((r) => r.cluster_id)
    .filter(Boolean) as string[];

  return NextResponse.json({ liked, saved, ignored });
}
