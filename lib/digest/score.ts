/**
 * Interest scoring — purely deterministic.
 *
 * Assigns a rank to each cluster based on:
 *   - User's explicit topic interest weight (from topic_interests table)
 *   - Number of items in the cluster (more coverage = more important)
 *   - Recency of the most recent item in the cluster
 *
 * Updates topic_clusters.rank in place.
 */
import { createServiceClient } from "@/lib/supabase/service";

// Weight for unknown topics (no entry in topic_interests)
const DEFAULT_INTEREST_WEIGHT = 1.0;

export async function scoreClusters(
  userId: string,
  clusterIds: string[]
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

  // Load recency data: most recent raw_item per cluster
  const allItemIds = clusters.flatMap((c) => c.raw_item_ids as string[]);
  const { data: itemRecency } = await supabase
    .from("raw_items")
    .select("id, received_at")
    .in("id", allItemIds);

  const recencyById = new Map<string, string>(
    (itemRecency ?? []).map((r) => [r.id, r.received_at])
  );

  // Score each cluster
  const scored = clusters.map((cluster) => {
    const itemIds = cluster.raw_item_ids as string[];
    const itemCount = itemIds.length;

    // Interest weight: try exact match, then partial/word match, then default
    const interestWeight = resolveInterestWeight(
      cluster.topic,
      interestMap
    );

    // Recency factor: 1.0 for last hour, decaying to 0.5 at 7 days
    const latestTs = itemIds
      .map((id) => new Date(recencyById.get(id) ?? 0).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const ageHours = latestTs
      ? (Date.now() - latestTs) / (1000 * 60 * 60)
      : 168;
    const recencyFactor = Math.max(0.5, 1 - ageHours / 336); // 336h = 14 days

    // Final score — higher is ranked first (rank = 0 = top)
    const score = interestWeight * Math.log(itemCount + 1) * recencyFactor;

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
