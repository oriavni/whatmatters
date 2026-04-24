/**
 * Full digest generation pipeline.
 * Triggered by: digest/generate event.
 *
 * Pipeline (deterministic → LLM → deterministic):
 *   1. Load unprocessed items for the window        [deterministic]
 *   2. Create digest row (status=generating)        [deterministic]
 *   3. Preprocess + LLM cluster refinement          [deterministic + 1 LLM call]
 *   4. Score clusters by interest                   [deterministic]
 *   5. Synthesize top clusters (max 8)              [1 LLM call per cluster]
 *   6. Compose plain_body, set status=ready         [deterministic]
 *   7. Fire digest/send
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { clusterItems } from "@/lib/digest/cluster";
import { scoreClusters } from "@/lib/digest/score";
import { synthesizeClusters } from "@/lib/digest/synthesize";
import { composeDigest } from "@/lib/digest/compose";

interface DigestGenerateEvent {
  user_id: string;
  trigger: "scheduled" | "on_demand";
  period_start?: string; // ISO — defaults to 24h ago
  period_end?: string;   // ISO — defaults to now
}

export const digestGenerate = inngest.createFunction(
  {
    id: "digest-generate",
    name: "Generate Digest",
    triggers: [{ event: "digest/generate" }],
    retries: 2,
    // Prevent duplicate concurrent runs for the same user
    concurrency: {
      limit: 1,
      key: "event.data.user_id",
    },
    // If all retries are exhausted, mark any stuck digest row as failed so the
    // user can click "Read now" again without hitting the 409 guard.
    onFailure: async ({ event, step }) => {
      const user_id = (event.data.event as { data: DigestGenerateEvent }).data
        .user_id;
      await step.run("mark-digest-failed-on-crash", async () => {
        const supabase = createServiceClient();
        await supabase
          .from("digests")
          .update({ status: "failed" })
          .eq("user_id", user_id)
          .in("status", ["pending", "generating"]);
      });
    },
  },
  async ({ event, step }) => {
    const { user_id, trigger, period_start, period_end } =
      event.data as DigestGenerateEvent;

    const periodEnd = period_end ?? new Date().toISOString();
    const periodStart =
      period_start ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // ── Step 1: Load items for window ─────────────────────────────────────
    const itemIds = await step.run("load-items", async () => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("raw_items")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_processed", true)
        .eq("is_promotional", false)
        .gte("received_at", periodStart)
        .lte("received_at", periodEnd)
        .order("received_at", { ascending: false })
        .limit(150);

      if (error) throw new Error(`load-items: ${error.message}`);
      return (data ?? []).map((r) => r.id);
    });

    if (itemIds.length === 0) {
      return { status: "no-items", user_id };
    }

    // ── Step 2: Create digest row ─────────────────────────────────────────
    const digestId = await step.run("create-digest", async () => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("digests")
        .insert({
          user_id,
          status: "generating",
          period_start: periodStart,
          period_end: periodEnd,
          metadata: { trigger, item_count: itemIds.length },
        })
        .select("id")
        .single();

      if (error || !data) throw new Error(`create-digest: ${error?.message}`);
      return data.id as string;
    });

    // ── Step 3: Preprocess (deterministic) + LLM cluster (one call) ───────
    const clusterIds = await step.run("cluster", () =>
      clusterItems(user_id, digestId, itemIds)
    );

    if (clusterIds.length === 0) {
      await step.run("mark-failed", async () => {
        const supabase = createServiceClient();
        await supabase
          .from("digests")
          .update({ status: "failed" })
          .eq("id", digestId);
      });
      return { status: "no-clusters", digest_id: digestId };
    }

    // ── Step 4: Score clusters (deterministic) ────────────────────────────
    await step.run("score", () => scoreClusters(user_id, clusterIds));

    // ── Step 4.5: Apply topic suppressions ────────────────────────────────
    // Remove clusters whose topic the user has temporarily suppressed.
    // Also decrements digests_remaining so the suppression expires automatically.
    const activeClusterIds = await step.run("apply-suppressions", async () => {
      const supabase = createServiceClient();

      // Check for any active suppressions for this user
      const { data: suppressions } = await supabase
        .from("topic_suppressions")
        .select("topic, digests_remaining")
        .eq("user_id", user_id)
        .gt("digests_remaining", 0);

      if (!suppressions || suppressions.length === 0) return clusterIds;

      // Resolve cluster topics for this digest
      const { data: clusters } = await supabase
        .from("topic_clusters")
        .select("id, topic")
        .in("id", clusterIds);

      if (!clusters || clusters.length === 0) return clusterIds;

      const suppressedTopics = new Set(
        suppressions.map((s) => (s.topic as string).toLowerCase())
      );

      // Identify which clusters match a suppressed topic (case-insensitive exact match)
      const suppressedClusterIds = clusters
        .filter((c) => suppressedTopics.has((c.topic as string).toLowerCase()))
        .map((c) => c.id as string);

      if (suppressedClusterIds.length > 0) {
        await supabase
          .from("topic_clusters")
          .delete()
          .in("id", suppressedClusterIds);
      }

      // Decrement digests_remaining for all active suppressions;
      // delete rows that have reached zero.
      for (const s of suppressions) {
        const remaining = (s.digests_remaining as number) - 1;
        if (remaining <= 0) {
          await supabase
            .from("topic_suppressions")
            .delete()
            .eq("user_id", user_id)
            .eq("topic", s.topic);
        } else {
          await supabase
            .from("topic_suppressions")
            .update({ digests_remaining: remaining, updated_at: new Date().toISOString() })
            .eq("user_id", user_id)
            .eq("topic", s.topic);
        }
      }

      return clusterIds.filter((id) => !suppressedClusterIds.includes(id));
    });

    if (activeClusterIds.length === 0) {
      await step.run("mark-failed-no-active-clusters", async () => {
        const supabase = createServiceClient();
        await supabase.from("digests").update({ status: "failed" }).eq("id", digestId);
      });
      return { status: "no-clusters-after-suppression", digest_id: digestId };
    }

    // ── Step 5: Synthesize top 8 clusters (LLM, sequential) ──────────────
    await step.run("synthesize", () => synthesizeClusters(activeClusterIds));

    // ── Step 6: Compose digest body (deterministic) ───────────────────────
    await step.run("compose", () => composeDigest(user_id, digestId));

    // ── Step 7: Fire digest/send ──────────────────────────────────────────
    await step.sendEvent("trigger-send", {
      name: "digest/send",
      data: { digest_id: digestId, user_id },
    });

    return { status: "ok", digest_id: digestId, cluster_count: activeClusterIds.length };
  }
);
