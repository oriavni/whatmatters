/**
 * Topic clustering — deterministic preprocessing + one LLM call for refinement.
 *
 * Returns the IDs of the inserted topic_cluster rows plus a salience map
 * (clusterDbId → salience 1–5) that the scoring step uses to weight results.
 * All new model output fields are optional — missing/invalid values fall back
 * to safe defaults so the pipeline never breaks on older model responses.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { generate } from "@/lib/llm/client";
import {
  buildClusteringPrompt,
  type ClusterOutput,
  type ClusterItemOutput,
} from "@/lib/llm/prompts/cluster";
import { preprocess, type RawItemMinimal } from "@/lib/digest/preprocess";
import { config } from "@/lib/config";

/** Valid cluster_type values — used for model output validation. */
const VALID_CLUSTER_TYPES = new Set([
  "event", "trend", "analysis", "announcement", "guide", "opinion", "other",
]);

/** Normalise a raw model cluster to safe defaults for all new optional fields. */
function normaliseCluster(c: ClusterItemOutput): Required<ClusterItemOutput> {
  const salience =
    typeof c.salience === "number" && c.salience >= 1 && c.salience <= 5
      ? Math.round(c.salience)
      : 3;

  const cluster_type =
    typeof c.cluster_type === "string" && VALID_CLUSTER_TYPES.has(c.cluster_type)
      ? c.cluster_type
      : "other";

  const key_entities = Array.isArray(c.key_entities)
    ? (c.key_entities as unknown[]).filter((e): e is string => typeof e === "string")
    : [];

  const sources = Array.isArray(c.sources)
    ? (c.sources as unknown[]).filter((s): s is string => typeof s === "string")
    : [];

  const source_count =
    typeof c.source_count === "number" && c.source_count >= 0
      ? c.source_count
      : sources.length;

  const has_multiple_sources =
    typeof c.has_multiple_sources === "boolean"
      ? c.has_multiple_sources
      : source_count > 1;

  return {
    label: c.label,
    item_ids: c.item_ids,
    salience,
    cluster_type,
    key_entities,
    sources,
    source_count,
    has_multiple_sources,
  };
}

export async function clusterItems(
  userId: string,
  digestId: string,
  itemIds: string[]
): Promise<{
  clusterIds: string[];
  /** Plain object (not Map) so Inngest can serialise it across step boundaries. */
  salienceByClusterId: Record<string, number>;
  tokensIn: number;
  tokensOut: number;
}> {
  const supabase = createServiceClient();

  // ── Load items + source names ─────────────────────────────────────────────
  const { data: rawItems, error: itemsError } = await supabase
    .from("raw_items")
    .select("id, subject, body_text, source_id, received_at, metadata")
    .in("id", itemIds);

  if (itemsError || !rawItems?.length) {
    throw new Error(`clusterItems: load failed — ${itemsError?.message}`);
  }

  // Load source names for context
  const sourceIds = [...new Set(rawItems.map((r) => r.source_id).filter(Boolean))];
  const sourceNames = new Map<string, string>();
  if (sourceIds.length > 0) {
    const { data: sources } = await supabase
      .from("sources")
      .select("id, name")
      .in("id", sourceIds as string[]);
    sources?.forEach((s) => sourceNames.set(s.id, s.name));
  }

  // ── Deterministic preprocessing ───────────────────────────────────────────
  const preGroups = preprocess(rawItems as RawItemMinimal[], sourceNames);

  if (preGroups.length === 0) {
    return { clusterIds: [], salienceByClusterId: {}, tokensIn: 0, tokensOut: 0 };
  }

  // Flatten pre-groups into the LLM input format
  const llmItems = preGroups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      source: item.sourceName,
    }))
  );

  // ── LLM clustering (one call) ─────────────────────────────────────────────
  const { system, user } = buildClusteringPrompt(llmItems);
  const response = await generate(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      model: config.llm.clusteringModel,
      temperature: 0.1, // low temperature for consistent JSON structure
      responseFormat: "json_object",
    }
  );

  let clusterOutput: ClusterOutput;
  try {
    clusterOutput = JSON.parse(response.content) as ClusterOutput;
  } catch {
    throw new Error(`clusterItems: LLM returned invalid JSON — ${response.content.slice(0, 200)}`);
  }

  if (!Array.isArray(clusterOutput.clusters) || clusterOutput.clusters.length === 0) {
    throw new Error("clusterItems: LLM returned empty clusters array");
  }

  // Normalise all clusters to safe defaults
  const normalisedClusters = clusterOutput.clusters.map(normaliseCluster);

  // Build a lookup: item_id → NormalizedItem (to filter out phantom IDs)
  const itemById = new Map(
    preGroups.flatMap((g) => g.items.map((item) => [item.id, item]))
  );

  // ── Persist topic_clusters ────────────────────────────────────────────────
  // rank: use position in the model's already-salience-ordered list as initial
  // ordering; scoreClusters will overwrite rank using the salienceByClusterId
  // map returned here plus interest/recency factors.
  const clusterRows = normalisedClusters.map((c, idx) => ({
    digest_id: digestId,
    user_id: userId,
    topic: c.label,
    rank: idx,
    raw_item_ids: c.item_ids.filter((id) => itemById.has(id)),
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("topic_clusters")
    .insert(clusterRows)
    .select("id");

  if (insertError || !inserted) {
    throw new Error(`clusterItems: insert clusters failed — ${insertError?.message}`);
  }

  // Build the salience map: DB row ID → salience (1–5).
  // Supabase returns inserted rows in insertion order, matching normalisedClusters.
  const salienceByClusterId: Record<string, number> = {};
  inserted.forEach((row, i) => {
    salienceByClusterId[row.id] = normalisedClusters[i]?.salience ?? 3;
  });

  return {
    clusterIds: inserted.map((r) => r.id),
    salienceByClusterId,
    tokensIn: response.usage?.prompt_tokens ?? 0,
    tokensOut: response.usage?.completion_tokens ?? 0,
  };
}
