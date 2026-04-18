import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/interactions?cluster_ids=id1,id2,...
 *
 * Returns the current user's interaction state for a set of clusters:
 *   liked        — cluster_ids with a thumbs_up row in feedback_events
 *   saved        — cluster_ids present in saved_items
 *   ignoreLevels — map of cluster_id → active suppress level (1-3)
 *                  only clusters with a level > 0 appear here
 *
 * Ignore state is keyed by topic (not cluster_id) because suppressions carry
 * across digest windows. We resolve cluster → topic → suppression in one pass.
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
    return NextResponse.json({ liked: [], saved: [], ignoreLevels: {} });
  }

  const service = createServiceClient();

  const [likedResult, savedResult, clustersResult, suppressionsResult] =
    await Promise.all([
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

      // Resolve cluster_id → topic so we can look up topic_suppressions
      service
        .from("topic_clusters")
        .select("id, topic")
        .in("id", clusterIds),

      // Fetch all active suppressions for this user (no cluster filter needed)
      service
        .from("topic_suppressions")
        .select("topic, suppress_level")
        .eq("user_id", user.id)
        .gt("digests_remaining", 0),
    ]);

  const liked = (likedResult.data ?? [])
    .map((r) => r.cluster_id)
    .filter(Boolean) as string[];

  const saved = (savedResult.data ?? [])
    .map((r) => r.cluster_id)
    .filter(Boolean) as string[];

  // Build topic → suppress_level map from active suppressions
  const suppressByTopic = new Map<string, number>(
    (suppressionsResult.data ?? []).map((s) => [
      (s.topic as string).toLowerCase(),
      s.suppress_level as number,
    ])
  );

  // For each cluster in this request, look up its suppress level by topic
  const ignoreLevels: Record<string, number> = {};
  for (const cluster of clustersResult.data ?? []) {
    const level = suppressByTopic.get((cluster.topic as string).toLowerCase()) ?? 0;
    if (level > 0) {
      ignoreLevels[cluster.id as string] = level;
    }
  }

  return NextResponse.json({ liked, saved, ignoreLevels });
}
