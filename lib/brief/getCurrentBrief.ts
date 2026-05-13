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
import type { CompiledDigestJson } from "@/lib/digest/buildCompiledDigest";

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

  // Single query — includes compiled_json for the fast path.
  // For pending/generating/failed digests compiled_json will be null, which is fine.
  const { data: latestAny, error } = await db
    .from("digests")
    .select("id, subject, period_end, status, sent_at, compiled_json")
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

  // ── Fast path: compiled_json present ─────────────────────────────────────
  // New digests (post-migration) have the full payload pre-assembled at
  // generation time. Parse and return directly — no further DB queries needed.
  if (latestAny.compiled_json) {
    const compiled = latestAny.compiled_json as CompiledDigestJson;
    // Recompute periodLabel at read time so locale/timezone stays consistent
    // with the server rendering environment (compiled_json stores it too, but
    // we recalculate to be safe).
    const periodLabel = new Date(latestAny.period_end).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    return {
      digest: {
        ...compiled,
        // Ensure live values from the digest row take precedence over the
        // snapshot stored at generation time (status may have changed to "sent").
        id: latestAny.id,
        subject: latestAny.subject,
        status: latestAny.status as "ready" | "sent",
        sentAt: latestAny.sent_at,
        periodLabel,
      },
      generationStatus: "idle",
    };
  }

  // ── Fallback: no compiled_json (pre-migration digests) ───────────────────
  // TODO: consider a background backfill job to populate compiled_json for
  // existing digests so this path is never hit in steady state.

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

  // Items must be fetched before sources (we need item.source_id to know which
  // sources to load). Two sequential round-trips is unavoidable here.
  const allItemIds = clusterRows.flatMap((c) => c.raw_item_ids as string[]);

  const { data: items } = await db
    .from("raw_items")
    .select("id, source_id, metadata")
    .in("id", allItemIds);

  const sourceIds = [
    ...new Set((items ?? []).map((r) => r.source_id).filter(Boolean)),
  ] as string[];

  const { data: sourcesData } = await db
    .from("sources")
    .select("id, name, url")
    .in("id", sourceIds);

  const sourceById = new Map(
    (sourcesData ?? []).map((s) => [s.id, { name: s.name as string, url: (s.url as string | null) ?? null }])
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
