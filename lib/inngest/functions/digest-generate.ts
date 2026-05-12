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
 *   7. Load data for email rendering                [deterministic]
 *   8. Render HTML email                            [deterministic]
 *   9. Send via Postmark                            [side-effect]
 *  10. Mark digest sent                             [deterministic]
 *
 * NOTE: Email send is inlined (steps 7-10) rather than firing a separate
 * digest/send event. This ensures delivery even if Inngest function sync
 * hasn't run after a deploy.
 */
import * as React from "react";
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { clusterItems } from "@/lib/digest/cluster";
import { scoreClusters } from "@/lib/digest/score";
import { synthesizeClusters } from "@/lib/digest/synthesize";
import { composeDigest } from "@/lib/digest/compose";
import { writeJobLog } from "@/lib/inngest/log";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/postmark";
import { DigestEmail, type DigestClusterForEmail } from "@/lib/email/templates/digest";
import { selectFullBlockIds } from "@/lib/digest/tier";
import { config } from "@/lib/config";

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
    onFailure: async ({ event, error, step }) => {
      const { user_id } = (event.data.event as { data: DigestGenerateEvent }).data;
      const errorMsg = (error as Error | undefined)?.message ?? "Unknown error";
      await step.run("mark-digest-failed-on-crash", async () => {
        const supabase = createServiceClient();
        const now = new Date().toISOString();
        await supabase
          .from("digests")
          .update({
            status: "failed",
            error_message: errorMsg,
            finished_at: now,
          })
          .eq("user_id", user_id)
          .in("status", ["pending", "generating"]);
        await writeJobLog({
          jobName: "digest-generate",
          status: "failed",
          userId: user_id,
          error: errorMsg,
        });
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
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd)
        .order("created_at", { ascending: false })
        .limit(150);

      if (error) throw new Error(`load-items: ${error.message}`);
      return (data ?? []).map((r) => r.id);
    });

    if (itemIds.length === 0) {
      await writeJobLog({
        jobName: "digest-generate",
        status: "done",
        userId: user_id,
        metadata: { reason: "no-items", trigger },
      });
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
          started_at: new Date().toISOString(),
          metadata: { trigger, item_count: itemIds.length },
        })
        .select("id")
        .single();

      if (error || !data) throw new Error(`create-digest: ${error?.message}`);
      return data.id as string;
    });

    // ── Step 3: Preprocess (deterministic) + LLM cluster (one call) ───────
    const clusterResult = await step.run("cluster", () =>
      clusterItems(user_id, digestId, itemIds)
    );
    const clusterIds = clusterResult.clusterIds;

    if (clusterIds.length === 0) {
      await step.run("mark-failed", async () => {
        const supabase = createServiceClient();
        const now = new Date().toISOString();
        await supabase
          .from("digests")
          .update({ status: "failed", error_message: "No clusters produced from items", finished_at: now })
          .eq("id", digestId);
        await writeJobLog({
          jobName: "digest-generate",
          status: "failed",
          userId: user_id,
          error: "No clusters produced from items",
          metadata: { digest_id: digestId },
        });
      });
      return { status: "no-clusters", digest_id: digestId };
    }

    // ── Step 4: Score clusters (deterministic) ────────────────────────────
    // Pass the LLM's salience map so the scoring formula can incorporate it.
    await step.run("score", () =>
      scoreClusters(user_id, clusterIds, clusterResult.salienceByClusterId)
    );

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
        const now = new Date().toISOString();
        await supabase
          .from("digests")
          .update({ status: "failed", error_message: "All clusters suppressed by user preferences", finished_at: now })
          .eq("id", digestId);
        await writeJobLog({
          jobName: "digest-generate",
          status: "failed",
          userId: user_id,
          error: "All clusters suppressed by user preferences",
          metadata: { digest_id: digestId },
        });
      });
      return { status: "no-clusters-after-suppression", digest_id: digestId };
    }

    // ── Step 5: Synthesize top 8 clusters (LLM, sequential) ──────────────
    const synthResult = await step.run("synthesize", () =>
      synthesizeClusters(activeClusterIds)
    );

    // ── Step 6: Compose digest body (deterministic) ───────────────────────
    await step.run("compose", () => composeDigest(user_id, digestId));

    // ── Step 6.5: Record cumulative LLM token usage ───────────────────────
    // Type cast: llm_tokens_input/output columns added by migration 20260427000003;
    // TS types update after `supabase gen types` is re-run.
    await step.run("record-costs", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("digests")
        .update({
          llm_tokens_input: clusterResult.tokensIn + synthResult.tokensIn,
          llm_tokens_output: clusterResult.tokensOut + synthResult.tokensOut,
        } as Record<string, unknown>)
        .eq("id", digestId);
    });

    // ── Step 7: Load email data ───────────────────────────────────────────
    const { clusters: clustersForEmail, userEmail } = await step.run("load-email-data", async () => {
      const supabase = createServiceClient();

      const [
        { data: clusterRows, error: clustersError },
        { data: userRow, error: userError },
      ] = await Promise.all([
        supabase
          .from("topic_clusters")
          .select("id, topic, summary, rank, score, raw_item_ids")
          .eq("digest_id", digestId)
          .order("rank", { ascending: true }),
        supabase
          .from("users")
          .select("email")
          .eq("id", user_id)
          .single(),
      ]);

      if (clustersError) throw new Error(`load clusters: ${clustersError.message}`);
      if (userError || !userRow?.email) throw new Error(`load user email: ${userError?.message ?? "no email"}`);

      const allItemIds = (clusterRows ?? []).flatMap((c) => c.raw_item_ids as string[]);
      const { data: items } = await supabase
        .from("raw_items")
        .select("id, subject, source_id, metadata")
        .in("id", allItemIds);

      const sourceIds = [...new Set((items ?? []).map((r) => r.source_id).filter(Boolean))] as string[];
      const { data: sources } = await supabase
        .from("sources")
        .select("id, name, url")
        .in("id", sourceIds);

      const sourceById = new Map<string, { name: string; url: string | null }>(
        (sources ?? []).map((s) => [s.id, { name: s.name, url: s.url ?? null }])
      );
      const itemById = new Map(
        (items ?? []).map((item) => {
          const src = item.source_id ? (sourceById.get(item.source_id) ?? null) : null;
          return [item.id, {
            id: item.id,
            title: (item.subject ?? "").trim(),
            sourceUrl: (item.metadata as { source_url?: string })?.source_url ?? null,
            sourceName: src?.name ?? "Unknown",
            _sourceId: item.source_id ?? null,
          }];
        })
      );

      const fullBlockIds = selectFullBlockIds(
        (clusterRows ?? []).map((c) => ({ id: c.id, score: c.score }))
      );

      const clusters: DigestClusterForEmail[] = (clusterRows ?? []).map((c) => {
        const clusterItems = (c.raw_item_ids as string[])
          .map((id) => itemById.get(id))
          .filter((item): item is NonNullable<ReturnType<typeof itemById.get>> => item !== undefined);
        const seen = new Set<string>();
        const uniqueSources: { name: string; url: string | null }[] = [];
        for (const item of clusterItems) {
          if (item._sourceId && !seen.has(item._sourceId)) {
            seen.add(item._sourceId);
            const s = sourceById.get(item._sourceId);
            if (s) uniqueSources.push(s);
          }
        }
        return {
          id: c.id,
          topic: c.topic,
          summary: c.summary,
          rank: c.rank,
          isFullBlock: fullBlockIds.has(c.id),
          items: clusterItems.map(({ id, title, sourceUrl, sourceName }) => ({ id, title, sourceUrl, sourceName })),
          sources: uniqueSources,
        };
      });

      return { clusters, userEmail: userRow.email };
    });

    // ── Step 8: Render email HTML ─────────────────────────────────────────
    const { html, text } = await step.run("render-email", async () => {
      const { data: digestRow } = await createServiceClient()
        .from("digests")
        .select("subject, period_end, plain_body")
        .eq("id", digestId)
        .single();

      const periodLabel = new Date(digestRow?.period_end ?? new Date()).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      });
      const appUrl = config.app.url;
      const replyToAddress = `reply+${digestId}@${config.postmark.replyDomain}`;

      return renderEmail(
        React.createElement(DigestEmail, {
          digestId,
          subject: digestRow?.subject ?? "Your Brief",
          periodLabel,
          clusters: clustersForEmail,
          userEmail,
          replyToAddress,
          unsubscribeUrl: `${appUrl}/app/preferences`,
          preferencesUrl: `${appUrl}/app/preferences`,
          appUrl,
          listenUrl: `${appUrl}/app/audio-briefs/${digestId}`,
        })
      );
    });

    // ── Step 9: Send via Postmark ─────────────────────────────────────────
    const { messageId } = await step.run("send-email", async () => {
      const { data: digestRow } = await createServiceClient()
        .from("digests")
        .select("subject")
        .eq("id", digestId)
        .single();

      return sendEmail({
        to: userEmail,
        subject: digestRow?.subject ?? "Your Brief",
        htmlBody: html,
        textBody: text,
        replyTo: `reply+${digestId}@${config.postmark.replyDomain}`,
      });
    });

    // ── Step 10: Mark sent ────────────────────────────────────────────────
    await step.run("mark-sent", async () => {
      const supabase = createServiceClient();
      const now = new Date().toISOString();
      await supabase
        .from("digests")
        .update({
          status: "sent",
          sent_at: now,
          finished_at: now,
          postmark_message_id: messageId,
          html_body: html,
        })
        .eq("id", digestId);
    });

    // Record success in job_logs so the admin panel shows completed runs,
    // not just failures.
    await writeJobLog({
      jobName: "digest-generate",
      status: "done",
      userId: user_id,
      metadata: {
        digest_id: digestId,
        cluster_count: activeClusterIds.length,
        trigger,
        tokens_in:  clusterResult.tokensIn  + synthResult.tokensIn,
        tokens_out: clusterResult.tokensOut + synthResult.tokensOut,
        postmark_message_id: messageId,
      },
    });

    return { status: "sent", digest_id: digestId, cluster_count: activeClusterIds.length, messageId };
  }
);
