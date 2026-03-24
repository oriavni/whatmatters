/**
 * Per-cluster synthesis — one LLM call per cluster, top N only.
 *
 * Updates topic_clusters.summary in place.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { generate } from "@/lib/llm/client";
import { buildSynthesisPrompt } from "@/lib/llm/prompts/synthesize";
import { config } from "@/lib/config";

// Only synthesize this many clusters — caps LLM spend regardless of item count
const MAX_SYNTHESIS_CLUSTERS = 8;

export async function synthesizeClusters(clusterIds: string[]): Promise<void> {
  if (clusterIds.length === 0) return;

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

  // Load item texts for synthesis input
  const allItemIds = clusters.flatMap((c) => c.raw_item_ids as string[]);
  const { data: items } = await supabase
    .from("raw_items")
    .select("id, subject, body_text")
    .in("id", allItemIds);

  const itemTextById = new Map<string, string>(
    (items ?? []).map((item) => [
      item.id,
      // Use body_text excerpt; fall back to subject
      ((item.body_text ?? "").slice(0, 600) || item.subject) ?? "",
    ])
  );

  // Synthesize each cluster — sequential to avoid rate-limit spikes
  for (const cluster of clusters) {
    const itemTexts = (cluster.raw_item_ids as string[])
      .map((id) => itemTextById.get(id) ?? "")
      .filter((t) => t.length > 0);

    if (itemTexts.length === 0) continue;

    let summary: string | null = null;
    try {
      const { system, user } = buildSynthesisPrompt(cluster.topic, itemTexts);
      const response = await generate(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        {
          model: config.llm.synthesisModel,
          temperature: 0.4,
          maxTokens: 180,
        }
      );
      summary = response.content.trim();
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
    .select("id, subject, body_text")
    .in("id", cluster.raw_item_ids as string[]);

  const itemTexts = (items ?? [])
    .map((item) => (item.body_text ?? "").slice(0, 600) || (item.subject ?? ""))
    .filter((t) => t.length > 0);

  const { system, user } = buildSynthesisPrompt(cluster.topic, itemTexts);
  const response = await generate(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model: config.llm.synthesisModel, temperature: 0.4, maxTokens: 180 }
  );
  return response.content.trim();
}
