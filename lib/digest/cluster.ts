/**
 * Topic clustering — deterministic preprocessing + one LLM call for refinement.
 *
 * Returns the IDs of the inserted topic_cluster rows.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { generate } from "@/lib/llm/client";
import { buildClusteringPrompt, type ClusterOutput } from "@/lib/llm/prompts/cluster";
import { preprocess, type RawItemMinimal } from "@/lib/digest/preprocess";
import { config } from "@/lib/config";

export async function clusterItems(
  userId: string,
  digestId: string,
  itemIds: string[]
): Promise<string[]> {
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
    return [];
  }

  // Flatten pre-groups into the LLM input format
  // Each item gets its group context (representative title) prepended if grouped
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

  // Build a lookup: item_id → NormalizedItem (for bodyForSynthesis later)
  const itemById = new Map(
    preGroups.flatMap((g) => g.items.map((item) => [item.id, item]))
  );

  // ── Persist topic_clusters ────────────────────────────────────────────────
  const clusterRows = clusterOutput.clusters.map((c, idx) => ({
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

  return inserted.map((r) => r.id);
}
