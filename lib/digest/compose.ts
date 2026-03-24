/**
 * Digest composition — deterministic final assembly.
 *
 * Reads the scored, synthesized clusters and assembles a plain-text digest
 * body. Updates the digest row to status='ready'.
 *
 * HTML email rendering is handled in Prompt 8 (digest-send).
 * This step produces the plain_body for now; html_body is left null until then.
 */
import { createServiceClient } from "@/lib/supabase/service";

export async function composeDigest(
  userId: string,
  digestId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Load clusters sorted by rank
  const { data: clusters, error: clustersError } = await supabase
    .from("topic_clusters")
    .select("id, topic, summary, raw_item_ids, rank")
    .eq("digest_id", digestId)
    .order("rank", { ascending: true });

  if (clustersError) {
    throw new Error(`composeDigest: load clusters failed — ${clustersError.message}`);
  }

  if (!clusters?.length) {
    // Nothing to compose — mark failed so the scheduler can reschedule
    await supabase
      .from("digests")
      .update({ status: "failed" })
      .eq("id", digestId);
    return;
  }

  // ── Build plain-text body ─────────────────────────────────────────────────
  const lines: string[] = [];

  for (const cluster of clusters) {
    lines.push(`## ${cluster.topic}`);
    if (cluster.summary) {
      lines.push(cluster.summary);
    } else {
      lines.push(`${(cluster.raw_item_ids as string[]).length} items`);
    }
    lines.push("");
  }

  const plainBody = lines.join("\n").trim();

  // ── Build subject line ────────────────────────────────────────────────────
  // e.g. "Your Brief: AI / GPT-5, Climate Policy, Markets"
  const topTopics = clusters
    .slice(0, 3)
    .map((c) => c.topic)
    .join(", ");
  const subject = `Your Brief: ${topTopics}`;

  // ── Persist ───────────────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("digests")
    .update({
      plain_body: plainBody,
      subject,
      status: "ready",
    })
    .eq("id", digestId);

  if (updateError) {
    throw new Error(`composeDigest: update failed — ${updateError.message}`);
  }
}
