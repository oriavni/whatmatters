/**
 * Shared server-side helper for fetching the current digest + interactions
 * for a given user.
 *
 * Used by:
 *   - app/app/brief/page.tsx   — SSR initial load (no skeleton flash)
 *   - app/api/brief/current    — client polling during / after generation
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { selectFullBlockIds } from "@/lib/digest/tier";
import type { BriefCluster, BriefDigest } from "@/components/brief/types";

export type GenerationStatus = "idle" | "generating" | "failed";

export interface CurrentBriefResult {
  digest: BriefDigest | null;
  generationStatus: GenerationStatus;
}

export interface InteractionsResult {
  liked: string[];
  saved: string[];
  /** cluster_id → active suppress level (1–3) */
  ignoreLevels: Record<string, number>;
}

// ── Digest ────────────────────────────────────────────────────────────────────

export async function getCurrentBriefForUser(
  userId: string,
  service?: SupabaseClient
): Promise<CurrentBriefResult> {
  const db = service ?? createServiceClient();
  const t0 = Date.now();

  // Grab the latest digest row to surface generating/failed states too
  const { data: latestAny, error } = await db
    .from("digests")
    .select("id, subject, period_end, status, sent_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getCurrentBrief: ${error.message}`);

  const generationStatus: GenerationStatus =
    latestAny?.status === "pending" || latestAny?.status === "generating"
      ? "generating"
      : latestAny?.status === "failed"
      ? "failed"
      : "idle";

  const isViewable =
    latestAny?.status === "ready" || latestAny?.status === "sent";

  if (!latestAny || !isViewable) {
    return { digest: null, generationStatus };
  }

  // Load clusters
  const { data: clusterRows, error: clustersError } = await db
    .from("topic_clusters")
    .select("id, topic, summary, rank, score, raw_item_ids")
    .eq("digest_id", latestAny.id)
    .order("rank", { ascending: true });

  if (clustersError) throw new Error(`getCurrentBrief clusters: ${clustersError.message}`);
  if (!clusterRows?.length) {
    return {
      digest: buildDigest(latestAny, []),
      generationStatus: "idle",
    };
  }

  // Load items + sources in parallel
  const allItemIds = clusterRows.flatMap((c) => c.raw_item_ids as string[]);

  const { data: items } = await db
    .from("raw_items")
    .select("id, source_id, metadata")
    .in("id", allItemIds);

  const sourceIds = [
    ...new Set((items ?? []).map((r) => r.source_id).filter(Boolean)),
  ] as string[];

  const { data: sources } = await db
    .from("sources")
    .select("id, name, url")
    .in("id", sourceIds);

  const sourceById = new Map(
    (sources ?? []).map((s) => [s.id, { name: s.name as string, url: (s.url as string | null) ?? null }])
  );

  const itemById = new Map(
    (items ?? []).map((item) => [
      item.id,
      {
        sourceId: item.source_id as string | null,
        sourceName: item.source_id
          ? (sourceById.get(item.source_id)?.name ?? "Unknown")
          : "Unknown",
        sourceUrl:
          (item.metadata as { source_url?: string })?.source_url ?? null,
      },
    ])
  );

  const fullBlockIds = selectFullBlockIds(
    clusterRows.map((c) => ({ id: c.id, score: c.score }))
  );

  const clusters: BriefCluster[] = clusterRows.map((c) => {
    const itemDetails = (c.raw_item_ids as string[])
      .map((id) => itemById.get(id))
      .filter(
        (item): item is NonNullable<ReturnType<typeof itemById.get>> =>
          item !== undefined
      );

    const seen = new Set<string>();
    const uniqueSources: { id: string; name: string; url: string | null }[] = [];
    for (const item of itemDetails) {
      if (item.sourceId && !seen.has(item.sourceId)) {
        seen.add(item.sourceId);
        uniqueSources.push({
          id: item.sourceId,
          name: item.sourceName,
          url: sourceById.get(item.sourceId)?.url ?? null,
        });
      }
    }

    return {
      id: c.id,
      topic: c.topic as string,
      summary: c.summary as string | null,
      rank: c.rank as number,
      isFullBlock: fullBlockIds.has(c.id),
      sources: uniqueSources,
      sourceUrl: itemDetails[0]?.sourceUrl ?? null,
    };
  });

  console.log(`[getCurrentBriefForUser] total=${Date.now()-t0}ms clusters=${clusters.length}`);
  return {
    digest: buildDigest(latestAny, clusters),
    generationStatus: "idle",
  };
}

function buildDigest(
  row: { id: string; subject: string | null; period_end: string; status: string; sent_at: string | null },
  clusters: BriefCluster[]
): BriefDigest {
  const periodLabel = new Date(row.period_end).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return {
    id: row.id,
    subject: row.subject,
    periodLabel,
    status: row.status as "ready" | "sent",
    sentAt: row.sent_at,
    clusters,
  };
}

// ── Interactions ──────────────────────────────────────────────────────────────

export async function getInteractionsForDigest(
  userId: string,
  clusterIds: string[],
  service?: SupabaseClient
): Promise<InteractionsResult> {
  if (!clusterIds.length) return { liked: [], saved: [], ignoreLevels: {} };

  const db = service ?? createServiceClient();

  const [likedResult, savedResult, clustersResult, suppressionsResult] =
    await Promise.all([
      db
        .from("feedback_events")
        .select("cluster_id")
        .eq("user_id", userId)
        .eq("type", "thumbs_up")
        .in("cluster_id", clusterIds),
      db
        .from("saved_items")
        .select("cluster_id")
        .eq("user_id", userId)
        .in("cluster_id", clusterIds),
      db
        .from("topic_clusters")
        .select("id, topic")
        .in("id", clusterIds),
      db
        .from("topic_suppressions")
        .select("topic, suppress_level")
        .eq("user_id", userId)
        .gt("digests_remaining", 0),
    ]);

  const liked = (likedResult.data ?? []).map((r) => r.cluster_id as string);
  const saved = (savedResult.data ?? []).map((r) => r.cluster_id as string);

  const suppressionByTopic = new Map(
    (suppressionsResult.data ?? []).map((s) => [
      (s.topic as string).toLowerCase(),
      s.suppress_level as number,
    ])
  );

  const ignoreLevels: Record<string, number> = {};
  for (const c of clustersResult.data ?? []) {
    const level = suppressionByTopic.get((c.topic as string).toLowerCase()) ?? 0;
    if (level > 0) ignoreLevels[c.id as string] = level;
  }

  return { liked, saved, ignoreLevels };
}

// ── Freshness ─────────────────────────────────────────────────────────────────

export interface FreshnessResult {
  newCount: number;
  lastDigestAt: string | null;
}

export async function getFreshnessForUser(
  userId: string,
  service?: SupabaseClient
): Promise<FreshnessResult> {
  const db = service ?? createServiceClient();

  const { data: lastDigest } = await db
    .from("digests")
    .select("created_at")
    .eq("user_id", userId)
    .in("status", ["ready", "sent"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastDigestAt = lastDigest?.created_at ?? null;

  let query = db
    .from("raw_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (lastDigestAt) query = query.gt("created_at", lastDigestAt);

  const { count } = await query;

  return { newCount: count ?? 0, lastDigestAt };
}
