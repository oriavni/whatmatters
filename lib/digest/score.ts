/**
 * Interest scoring — purely deterministic.
 *
 * Assigns a rank to each cluster based on:
 *   - User's explicit topic interest weight (from topic_interests table)
 *   - Number of items in the cluster (more coverage = more important)
 *   - Recency of the most recent item in the cluster
 *   - LLM-assigned salience 1–5 (from clustering step, passed in salienceByClusterId)
 *   - Source diversity bonus: multiple independent sources covering the same
 *     story signals broader importance
 *
 * Updates topic_clusters.rank in place.
 */
import { createServiceClient } from "@/lib/supabase/service";

// Weight for unknown topics (no entry in topic_interests)
const DEFAULT_INTEREST_WEIGHT = 1.0;

export async function scoreClusters(
  userId: string,
  clusterIds: string[],
  /**
   * Salience values (1–5) from the LLM clustering step, keyed by cluster DB id.
   * Optional: plain Record so it survives Inngest step serialisation.
   * Missing entries default to 3 (neutral).
   */
  salienceByClusterId?: Record<string, number>
): Promise<void> {
  if (clusterIds.length === 0) return;

  const supabase = createServiceClient();

  // Load clusters
  const { data: clusters, error: clustersError } = await supabase
    .from("topic_clusters")
    .select("id, topic, raw_item_ids")
    .in("id", clusterIds);

  if (clustersError || !clusters?.length) {
    throw new Error(`scoreClusters: load failed — ${clustersError?.message}`);
  }

  // Load user's topic interest weights
  const { data: interests } = await supabase
    .from("topic_interests")
    .select("topic, weight")
    .eq("user_id", userId);

  const interestMap = new Map<string, number>(
    (interests ?? []).map((i) => [i.topic.toLowerCase(), i.weight])
  );

  // Load recency + source_id data for all items in one query
  const allItemIds = clusters.flatMap((c) => c.raw_item_ids as string[]);
  const { data: itemData } = await supabase
    .from("raw_items")
    .select("id, received_at, source_id")
    .in("id", allItemIds);

  const recencyById = new Map<string, string>(
    (itemData ?? []).map((r) => [r.id, r.received_at])
  );
  const sourceIdById = new Map<string, string | null>(
    (itemData ?? []).map((r) => [r.id, r.source_id])
  );

  // Score each cluster
  const scored = clusters.map((cluster) => {
    const itemIds = cluster.raw_item_ids as string[];
    const itemCount = itemIds.length;

    // Interest weight: try exact match, then partial/word match, then default
    const interestWeight = resolveInterestWeight(cluster.topic, interestMap);

    // Recency factor: 1.0 for last hour, decaying to 0.5 at 7 days
    const latestTs = itemIds
      .map((id) => new Date(recencyById.get(id) ?? 0).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const ageHours = latestTs
      ? (Date.now() - latestTs) / (1000 * 60 * 60)
      : 168;
    const recencyFactor = Math.max(0.5, 1 - ageHours / 336); // 336h = 14 days

    // Salience factor: LLM editorial judgment (1–5 → 0.33–1.67 multiplier)
    // salience=3 (default) → 1.0 (no change to existing behaviour for old data)
    const salience = salienceByClusterId?.[cluster.id] ?? 3;
    const salienceFactor = salience / 3;

    // Source diversity bonus: each additional unique source adds 15%
    // This captures the "multi-source corroboration = more important" rule
    // without requiring a schema change.
    const uniqueSourceCount = new Set(
      itemIds.map((id) => sourceIdById.get(id)).filter(Boolean)
    ).size;
    const sourceDiversityFactor = 1.0 + Math.max(0, uniqueSourceCount - 1) * 0.15;

    // Final score — higher is ranked first (rank = 0 = top)
    const score =
      interestWeight *
      Math.log(itemCount + 1) *
      recencyFactor *
      salienceFactor *
      sourceDiversityFactor;

    return { id: cluster.id, score };
  });

  // Sort descending by score; assign rank 0 = highest
  scored.sort((a, b) => b.score - a.score);

  // Persist rank + raw score so downstream steps can make gap-based tier decisions
  const updateResults = await Promise.all(
    scored.map((c, rank) =>
      supabase
        .from("topic_clusters")
        .update({ rank, score: c.score })
        .eq("id", c.id)
    )
  );

  const firstError = updateResults.find((r) => r.error)?.error;
  if (firstError) {
    throw new Error(`scoreClusters: update failed — ${firstError.message}`);
  }
}

function resolveInterestWeight(
  topicLabel: string,
  interestMap: Map<string, number>
): number {
  const lower = topicLabel.toLowerCase();

  // 1. Exact match
  if (interestMap.has(lower)) return interestMap.get(lower)!;

  // 2. Any word in the label matches a known topic
  const words = lower.split(/[\s/,–-]+/).filter((w) => w.length > 3);
  for (const word of words) {
    if (interestMap.has(word)) return interestMap.get(word)!;
  }

  // 3. Any known topic is a substring of the label (e.g. "AI" in "AI / OpenAI")
  for (const [topic, weight] of interestMap) {
    if (lower.includes(topic) || topic.includes(lower)) return weight;
  }

  return DEFAULT_INTEREST_WEIGHT;
}
