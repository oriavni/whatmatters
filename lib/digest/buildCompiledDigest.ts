/**
 * Assembles the render-ready BriefDigest payload from raw DB rows and saves it
 * into digests.compiled_json.
 *
 * Called at the end of digest generation (after clusters, items, and sources
 * are fully resolved). The result is stored once and read on every subsequent
 * page load — no joins, no additional queries.
 *
 * What IS included:
 *   - digest metadata (id, subject, period_end, status, sent_at)
 *   - ordered clusters with topic, summary, rank, isFullBlock
 *   - deduplicated sources per cluster (id, name, url)
 *   - first-item sourceUrl per cluster
 *
 * What is NOT included (must remain per-request):
 *   - interactions (liked / saved / ignoreLevels)
 *   - freshness / newCount
 *   - subscription / premium state
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { selectFullBlockIds } from "@/lib/digest/tier";
import type { BriefCluster, BriefDigest } from "@/components/brief/types";

export type CompiledDigestJson = BriefDigest;

export async function buildCompiledDigest(
  digestId: string,
  service?: SupabaseClient
): Promise<CompiledDigestJson> {
  const db = service ?? createServiceClient();

  // 1. Load digest row + clusters in parallel
  const [{ data: digestRow, error: digestError }, { data: clusterRows, error: clustersError }] =
    await Promise.all([
      db
        .from("digests")
        .select("id, subject, period_end, status, sent_at")
        .eq("id", digestId)
        .single(),
      db
        .from("topic_clusters")
        .select("id, topic, summary, rank, score, raw_item_ids")
        .eq("digest_id", digestId)
        .order("rank", { ascending: true }),
    ]);

  if (digestError || !digestRow) throw new Error(`buildCompiledDigest: digest not found — ${digestError?.message}`);
  if (clustersError) throw new Error(`buildCompiledDigest: clusters error — ${clustersError.message}`);

  const clusters = clusterRows ?? [];

  if (!clusters.length) {
    return buildPayload(digestRow, []);
  }

  // 2. Load items for all clusters
  const allItemIds = clusters.flatMap((c) => c.raw_item_ids as string[]);
  const { data: items } = await db
    .from("raw_items")
    .select("id, source_id, metadata")
    .in("id", allItemIds);

  // 3. Load sources for all items
  const sourceIds = [
    ...new Set((items ?? []).map((r) => r.source_id).filter(Boolean)),
  ] as string[];
  const { data: sources } = await db
    .from("sources")
    .select("id, name, url")
    .in("id", sourceIds);

  // 4. Build lookup maps
  const sourceById = new Map(
    (sources ?? []).map((s) => [
      s.id,
      { name: s.name as string, url: (s.url as string | null) ?? null },
    ])
  );
  const itemById = new Map(
    (items ?? []).map((item) => [
      item.id,
      {
        sourceId: item.source_id as string | null,
        sourceName: item.source_id
          ? (sourceById.get(item.source_id)?.name ?? "Unknown")
          : "Unknown",
        sourceUrl: (item.metadata as { source_url?: string })?.source_url ?? null,
      },
    ])
  );

  // 5. Compute isFullBlock for each cluster
  const fullBlockIds = selectFullBlockIds(
    clusters.map((c) => ({ id: c.id, score: c.score }))
  );

  // 6. Assemble BriefCluster array
  const briefClusters: BriefCluster[] = clusters.map((c) => {
    const itemDetails = (c.raw_item_ids as string[])
      .map((id) => itemById.get(id))
      .filter((item): item is NonNullable<ReturnType<typeof itemById.get>> => item !== undefined);

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

  return buildPayload(digestRow, briefClusters);
}

function buildPayload(
  row: { id: string; subject: string | null; period_end: string; status: string; sent_at: string | null },
  clusters: BriefCluster[]
): CompiledDigestJson {
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
