/**
 * Tier selection — determines which clusters render as full blocks vs short mentions.
 *
 * Algorithm:
 *   1. Sort clusters by score descending.
 *   2. Find the largest proportional score gap within the 2–6 range.
 *   3. Cut at that gap — everything above is a full block.
 *
 * Used by both digest-send (email) and /api/brief/current (in-app view).
 */
export function selectFullBlockIds(
  clusters: { id: string; score: number }[]
): Set<string> {
  const MIN = 2;
  const MAX = 6;

  if (clusters.length <= MIN) return new Set(clusters.map((c) => c.id));

  const sorted = [...clusters].sort((a, b) => b.score - a.score);
  const capped = sorted.slice(0, MAX);

  let cutIndex = MIN;
  let maxGap = 0;

  for (let i = MIN; i < capped.length; i++) {
    const prev = capped[i - 1].score;
    const curr = capped[i].score;
    const gap = prev > 0 ? (prev - curr) / prev : 0;
    if (gap > maxGap) {
      maxGap = gap;
      cutIndex = i;
    }
  }

  return new Set(capped.slice(0, cutIndex).map((c) => c.id));
}
