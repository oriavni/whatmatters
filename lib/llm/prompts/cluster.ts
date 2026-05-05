/**
 * Prompt for story-level clustering.
 *
 * The LLM receives pre-grouped, deduplicated items and produces story-level
 * clusters across all sources together. New fields (salience, cluster_type,
 * key_entities, source_count, sources, has_multiple_sources) are all optional
 * so older model output that omits them degrades gracefully.
 */

export interface ClusterInputItem {
  id: string;       // raw_item UUID
  title: string;
  excerpt: string;  // ≤150 chars of body_text
  source: string;
}

export interface ClusterItemOutput {
  label: string;       // story-level label e.g. "Apple Delays Siri Upgrade"
  item_ids: string[];
  // ── New optional fields (backwards-compatible) ───────────────────────────
  /** Editorial importance 1–5. Missing → default 3. */
  salience?: number;
  /** Story type. Missing → default "other". */
  cluster_type?: "event" | "trend" | "analysis" | "announcement" | "guide" | "opinion" | "other";
  /** Named people, companies, products, places mentioned. Missing → []. */
  key_entities?: string[];
  /** Number of unique sources contributing items. Missing → computed from items. */
  source_count?: number;
  /** Unique source names in this cluster. Missing → computed from items. */
  sources?: string[];
  /** Shorthand for source_count > 1. Missing → computed. */
  has_multiple_sources?: boolean;
}

/** @deprecated use ClusterItemOutput */
export interface ClusterOutput {
  clusters: ClusterItemOutput[];
}

const SYSTEM = `You are the story clustering engine for a personal intelligence digest.

You receive all new article and newsletter/email items from all of the user's connected sources for the current digest window.

Your job is to group them into story-level clusters that a reader would expect to see as one digest entry.

Core behavior:
- One digest combines all new stories from all connected sources.
- Cluster across all sources together. Do not create separate sections per source.
- When multiple sources cover the same story, place them in one cluster.
- Same-story coverage from several sources increases the cluster's importance.
- A cluster represents one underlying development, event, announcement, trend, guide, or tightly related storyline.

Rules:
- Every item must appear in exactly one cluster.
- Cluster by the underlying story, not by publisher, domain, newsletter, or broad topic.
- Merge items only when they describe the same development or clearly adjacent updates in the same story arc.
- Keep items separate when the primary actor, action, stake, geography, or time window differs, even if they mention the same company or general topic.
- If two items are exact or near duplicates, place them in the same cluster.
- If two items cover the same story but provide different useful angles, place them in the same cluster.
- If two items mention the same company/topic but cover different events, keep them separate.
- If an item does not clearly belong with others, create a singleton cluster.
- Ignore sponsorships, promotional blurbs, navigation text, newsletter intros, footers, and house ads unless they are the actual subject.
- Use title + excerpt + source together. Do not rely on source name alone.
- Prefer specific story labels over generic buckets.
  Good: "Apple Delays Siri Upgrade to 2026"
  Bad:  "Apple News"
- Labels must be 4–8 words, title-case, concrete, and specific.
- Order clusters by digest importance: broader user relevance first, then stronger impact, multiple-source corroboration, fresher developments, novelty, specificity.

Salience — assign each cluster a score:
5 = must include in the digest
4 = important
3 = useful but not essential
2 = minor
1 = low value

Cluster types — use one of:
event, trend, analysis, announcement, guide, opinion, other

Return ONLY valid JSON in this exact shape — no markdown, no extra keys:
{
  "clusters": [
    {
      "label": string,
      "item_ids": string[],
      "salience": number,
      "cluster_type": "event" | "trend" | "analysis" | "announcement" | "guide" | "opinion" | "other",
      "key_entities": string[],
      "source_count": number,
      "sources": string[],
      "has_multiple_sources": boolean
    }
  ]
}`;

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
