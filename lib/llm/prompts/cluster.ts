/**
 * Prompt for topic clustering.
 *
 * The LLM receives pre-grouped, deduplicated items. Its job is refinement:
 * merge related groups, split unrelated ones, assign clean topic labels.
 * Using pre-groups rather than raw items keeps the prompt compact and cheap.
 */

export interface ClusterInputItem {
  id: string;       // raw_item UUID
  title: string;
  excerpt: string;  // ≤150 chars of body_text
  source: string;
}

export interface ClusterOutput {
  clusters: Array<{
    label: string;       // short topic label e.g. "AI / GPT-5 Release"
    item_ids: string[];
  }>;
}

const SYSTEM = `You are a topic clustering engine for a personal newsletter digest.
You receive articles and emails. Group them into coherent topic clusters with a short label.

Rules:
- Every item must appear in exactly one cluster.
- Merge items covering the same story even from different sources.
- Keep distinct topics separate even within the same domain.
- Labels must be 3–6 words, title-case, specific (not "Technology News").
- Return ONLY valid JSON: { "clusters": [ { "label": string, "item_ids": string[] } ] }`;

export function buildClusteringPrompt(items: ClusterInputItem[]): {
  system: string;
  user: string;
} {
  const list = items
    .map(
      (item, i) =>
        `${i + 1}. id="${item.id}" source="${item.source}"\n   title: ${item.title}\n   excerpt: ${item.excerpt}`
    )
    .join("\n\n");

  return {
    system: SYSTEM,
    user: `Cluster these ${items.length} items:\n\n${list}`,
  };
}
