/**
 * Deterministic preprocessing before LLM work.
 *
 * Pipeline:
 *   1. Normalize — trim, truncate to LLM budget
 *   2. Deduplicate — by URL, then by title Jaccard similarity
 *   3. Heuristic pre-group — connected components on keyword overlap
 *      so the LLM receives groups, not a flat list of individual items
 */

import { truncateText } from "@/lib/ingestion/clean-html";

export interface RawItemMinimal {
  id: string;
  subject: string | null;
  body_text: string | null;
  source_id: string | null;
  received_at: string;
  metadata: { source_url?: string } | Record<string, unknown>;
}

export interface NormalizedItem {
  id: string;
  title: string;
  excerpt: string;   // ≤150 chars for LLM prompt
  bodyForSynthesis: string; // ≤800 chars for synthesis prompt
  sourceId: string | null;
  sourceName: string;
  receivedAt: string;
  titleWords: Set<string>; // pre-computed for dedup + grouping
}

export interface PreGroup {
  items: NormalizedItem[];
}

// ── Stopwords ─────────────────────────────────────────────────────────────────
// Common English words excluded from keyword overlap calculation
const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","this","that",
  "these","those","it","its","he","she","they","we","you","i","my","our","your",
  "his","her","their","about","how","what","when","where","who","which","why",
  "than","then","so","if","as","up","out","no","not","new","more","also","after",
  "says","said","say","just","can","use","one","two","all","some",
]);

const MIN_WORD_LENGTH = 3;
// Jaccard threshold above which two items are considered near-duplicates
const DEDUP_THRESHOLD = 0.5;
// Jaccard threshold for heuristic grouping (lower = more grouping)
const GROUP_THRESHOLD = 0.2;
// Maximum items to send to LLM (prevents runaway token usage)
const MAX_LLM_ITEMS = 40;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full preprocessing pipeline.
 * Returns heuristic pre-groups ready to be sent to the LLM clustering step.
 */
export function preprocess(
  items: RawItemMinimal[],
  sourceNames: Map<string, string>
): PreGroup[] {
  const normalized = items
    .map((item) => normalize(item, sourceNames))
    .filter((item): item is NormalizedItem => item !== null);

  const deduped = deduplicate(normalized);

  // Cap before grouping so LLM input is bounded
  const capped = deduped
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    .slice(0, MAX_LLM_ITEMS);

  return heuristicGroup(capped);
}

// ── Normalize ─────────────────────────────────────────────────────────────────

function normalize(
  item: RawItemMinimal,
  sourceNames: Map<string, string>
): NormalizedItem | null {
  const title = (item.subject ?? "").trim();
  const body = (item.body_text ?? "").trim();

  // Skip items with no usable text
  if (!title && body.length < 20) return null;

  const excerpt = truncateText(body || title, 150);
  const bodyForSynthesis = truncateText(body, 800);
  const sourceName = item.source_id
    ? (sourceNames.get(item.source_id) ?? "Unknown")
    : "Unknown";

  return {
    id: item.id,
    title: title || excerpt.slice(0, 80),
    excerpt,
    bodyForSynthesis,
    sourceId: item.source_id,
    sourceName,
    receivedAt: item.received_at,
    titleWords: tokenize(title || body),
  };
}

// ── Deduplicate ───────────────────────────────────────────────────────────────

function deduplicate(items: NormalizedItem[]): NormalizedItem[] {
  const kept: NormalizedItem[] = [];
  const merged = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    if (merged.has(items[i].id)) continue;

    for (let j = i + 1; j < items.length; j++) {
      if (merged.has(items[j].id)) continue;

      if (jaccard(items[i].titleWords, items[j].titleWords) >= DEDUP_THRESHOLD) {
        // Keep the more recent item, discard the other
        const keepI =
          new Date(items[i].receivedAt) >= new Date(items[j].receivedAt);
        merged.add(keepI ? items[j].id : items[i].id);
        if (!keepI) break; // items[i] is discarded — stop comparing it
      }
    }

    if (!merged.has(items[i].id)) kept.push(items[i]);
  }

  return kept;
}

// ── Heuristic pre-grouping ────────────────────────────────────────────────────
//
// Build a graph where edges connect items whose title keywords overlap
// above GROUP_THRESHOLD. Connected components become pre-groups.
// This means items covering the same story end up in the same group
// before the LLM even sees them.

function heuristicGroup(items: NormalizedItem[]): PreGroup[] {
  // Union-Find
  const parent = new Map<string, string>(items.map((item) => [item.id, item.id]));

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression
    let cur = id;
    while (cur !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  function union(a: string, b: string) {
    parent.set(find(a), find(b));
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (jaccard(items[i].titleWords, items[j].titleWords) >= GROUP_THRESHOLD) {
        union(items[i].id, items[j].id);
      }
    }
  }

  // Collect groups
  const groups = new Map<string, NormalizedItem[]>();
  for (const item of items) {
    const root = find(item.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(item);
  }

  return Array.from(groups.values()).map((groupItems) => ({ items: groupItems }));
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= MIN_WORD_LENGTH && !STOPWORDS.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}
