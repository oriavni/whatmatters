/**
 * Per-cluster synthesis — one LLM call per cluster, top N only.
 *
 * Updates topic_clusters.summary in place.
 *
 * Source names are now loaded and passed to the synthesis prompt so the model
 * can write "Bloomberg and The Verge both report…" style sentences when sources
 * genuinely differ. If source lookup fails, synthesis still runs without it.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { generate } from "@/lib/llm/client";
import { buildSynthesisPrompt } from "@/lib/llm/prompts/synthesize";
import { config } from "@/lib/config";

// Only synthesize this many clusters — caps LLM spend regardless of item count
const MAX_SYNTHESIS_CLUSTERS = 8;

export async function synthesizeClusters(
  clusterIds: string[]
): Promise<{ tokensIn: number; tokensOut: number }> {
  if (clusterIds.length === 0) return { tokensIn: 0, tokensOut: 0 };
  let tokensIn = 0;
  let tokensOut = 0;

  const supabase = createServiceClient();

  // Load clusters sorted by rank — synthesize the top N
  const { data: clusters, error } = await supabase
    .from("topic_clusters")
    .select("id, topic, raw_item_ids, rank")
    .in("id", clusterIds)
    .order("rank", { ascending: true })
    .limit(MAX_SYNTHESIS_CLUSTERS);

  if (error || !clusters?.length) {
    throw new Error(`synthesizeClusters: load failed — ${error?.message}`);
  }

  // Load item texts AND source_ids for all clusters in one query
  const allItemIds = clusters.flatMap((c) => c.raw_item_ids as string[]);
  const { data: items } = await supabase
    .from("raw_items")
    .select("id, subject, body_text, summary, source_id")
    .in("id", allItemIds);

  // Load source names in a single batch query
  const sourceIds = [
    ...new Set(
      (items ?? []).map((r) => r.source_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const sourceNameById = new Map<string, string>();
  if (sourceIds.length > 0) {
    const { data: sourcesData } = await supabase
      .from("sources")
      .select("id, name")
      .in("id", sourceIds);
    sourcesData?.forEach((s) => sourceNameById.set(s.id, s.name));
  }

  // Build per-item lookup: id → { text, sourceId }
  const itemDataById = new Map<string, { text: string; sourceId: string | null }>(
    (items ?? []).map((item) => [
      item.id,
      {
        // Use body_text excerpt; fall back to pre-extracted summary; finally subject
        text:
          ((item.body_text ?? "").slice(0, 600) || item.summary || item.subject) ?? "",
        sourceId: item.source_id ?? null,
      },
    ])
  );

  // Synthesize each cluster — sequential to avoid rate-limit spikes
  for (const cluster of clusters) {
    const itemIds = cluster.raw_item_ids as string[];

    const itemTexts = itemIds
      .map((id) => itemDataById.get(id)?.text ?? "")
      .filter((t) => t.length > 0);

    if (itemTexts.length === 0) continue;

    // Unique source names for this cluster (deduplicated, no nulls)
    const clusterSources = [
      ...new Set(
        itemIds
          .map((id) => {
            const sourceId = itemDataById.get(id)?.sourceId;
            return sourceId ? (sourceNameById.get(sourceId) ?? null) : null;
          })
          .filter((name): name is string => Boolean(name))
      ),
    ];

    let summary: string | null = null;
    try {
      const { system, user } = buildSynthesisPrompt(
        cluster.topic,
        itemTexts,
        clusterSources.length > 0 ? clusterSources : undefined
      );
      const response = await generate(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        {
          model: config.llm.synthesisModel,
          temperature: 0.4,
          maxTokens: 220, // bumped from 180 — richer sentences with source context
        }
      );
      summary = response.content.trim();
      tokensIn += response.usage?.prompt_tokens ?? 0;
      tokensOut += response.usage?.completion_tokens ?? 0;
    } catch (err) {
      // Non-fatal — leave summary null, digest still renders without it
      console.warn(`synthesizeClusters: failed for cluster ${cluster.id}:`, err);
    }

    if (summary) {
      await supabase
        .from("topic_clusters")
        .update({ summary })
        .eq("id", cluster.id);
    }
  }

  return { tokensIn, tokensOut };
}

/**
 * Single-cluster version — used for on-demand synthesis requests.
 */
export async function synthesizeCluster(clusterId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: cluster } = await supabase
    .from("topic_clusters")
    .select("id, topic, raw_item_ids")
    .eq("id", clusterId)
    .single();

  if (!cluster) throw new Error(`synthesizeCluster: cluster ${clusterId} not found`);

  const { data: items } = await supabase
    .from("raw_items")
    .select("id, subject, body_text, summary, source_id")
    .in("id", cluster.raw_item_ids as string[]);

  // Load source names
  const sourceIds = [
    ...new Set(
      (items ?? []).map((r) => r.source_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const sourceNameById = new Map<string, string>();
  if (sourceIds.length > 0) {
    const { data: sourcesData } = await supabase
      .from("sources")
      .select("id, name")
      .in("id", sourceIds);
    sourcesData?.forEach((s) => sourceNameById.set(s.id, s.name));
  }

  const itemTexts = (items ?? [])
    .map(
      (item) =>
        (item.body_text ?? "").slice(0, 600) || item.summary || (item.subject ?? "")
    )
    .filter((t) => t.length > 0);

  const clusterSources = [
    ...new Set(
      (items ?? [])
        .map((item) =>
          item.source_id ? (sourceNameById.get(item.source_id) ?? null) : null
        )
        .filter((name): name is string => Boolean(name))
    ),
  ];

  const { system, user } = buildSynthesisPrompt(
    cluster.topic,
    itemTexts,
    clusterSources.length > 0 ? clusterSources : undefined
  );
  const response = await generate(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: config.llm.synthesisModel, temperature: 0.4, maxTokens: 220 }
  );
  return response.content.trim();
}
