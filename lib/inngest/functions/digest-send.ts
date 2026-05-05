/**
 * Render and send a completed digest email.
 * Triggered by: digest/send event (fired at the end of digest-generate).
 *
 * Steps:
 *   1. Load digest + clusters + item/source data
 *   2. Render HTML + plain text via React Email
 *   3. Send via Postmark (with reply-to = reply+{digest_id}@{reply_domain})
 *   4. Update digest: status=sent, sent_at, postmark_message_id
 */
import * as React from "react";
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { writeJobLog } from "@/lib/inngest/log";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/postmark";
import { DigestEmail, type DigestClusterForEmail } from "@/lib/email/templates/digest";
import { config } from "@/lib/config";
import { selectFullBlockIds } from "@/lib/digest/tier";

interface DigestSendEvent {
  digest_id: string;
  user_id: string;
}

export const digestSend = inngest.createFunction(
  {
    id: "digest-send",
    name: "Send Digest Email",
    triggers: [{ event: "digest/send" }],
    retries: 3,
    // If all retries exhausted, mark digest failed so it's visible in admin
    // and doesn't stay stuck in status='ready' forever.
    onFailure: async ({ event, error }) => {
      const { digest_id, user_id } = (event.data.event as { data: DigestSendEvent }).data;
      const errorMsg = (error as Error | undefined)?.message ?? "Unknown error";
      const supabase = createServiceClient();
      const now = new Date().toISOString();
      await supabase
        .from("digests")
        .update({ status: "failed", error_message: `send failed: ${errorMsg}`, finished_at: now })
        .eq("id", digest_id);
      await writeJobLog({
        jobName: "digest-send",
        status: "failed",
        userId: user_id,
        error: errorMsg,
        metadata: { digest_id },
      });
    },
  },
  async ({ event, step }) => {
    const { digest_id, user_id } = event.data as DigestSendEvent;

    // ── Step 1: Load all data needed for rendering ────────────────────────
    const { digest, clusters, userEmail } = await step.run("load-data", async () => {
      const supabase = createServiceClient();

      const [
        { data: digest, error: digestError },
        { data: clusterRows, error: clustersError },
        { data: userRow, error: userError },
      ] = await Promise.all([
        supabase
          .from("digests")
          .select("id, subject, period_start, period_end, status, plain_body")
          .eq("id", digest_id)
          .single(),
        supabase
          .from("topic_clusters")
          .select("id, topic, summary, rank, score, raw_item_ids")
          .eq("digest_id", digest_id)
          .order("rank", { ascending: true }),
        supabase
          .from("users")
          .select("email")
          .eq("id", user_id)
          .single(),
      ]);

      if (digestError || !digest)
        throw new Error(`load digest: ${digestError?.message}`);
      if (clustersError)
        throw new Error(`load clusters: ${clustersError?.message}`);
      if (userError || !userRow)
        throw new Error(`load user: ${userError?.message}`);

      if (digest.status === "sent") {
        // Idempotency guard — already sent, skip
        return { digest, clusters: [], userEmail: userRow.email, alreadySent: true };
      }

      // Resolve source names for every item in every cluster
      const allItemIds = (clusterRows ?? []).flatMap(
        (c) => c.raw_item_ids as string[]
      );

      const { data: items } = await supabase
        .from("raw_items")
        .select("id, subject, source_id, metadata")
        .in("id", allItemIds);

      const sourceIds = [...new Set(
        (items ?? []).map((r) => r.source_id).filter(Boolean)
      )] as string[];

      // Include url so source names in the email can be hyperlinked
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
          return [
            item.id,
            {
              id: item.id,
              title: (item.subject ?? "").trim(),
              sourceUrl: (item.metadata as { source_url?: string })?.source_url ?? null,
              sourceName: src?.name ?? "Unknown",
              /** Kept for building the per-cluster sources list; not part of email item shape */
              _sourceId: item.source_id ?? null,
            },
          ];
        })
      );

      // Determine full-block set by score gap detection (importance, not position)
      const fullBlockIds = selectFullBlockIds(
        (clusterRows ?? []).map((c) => ({ id: c.id, score: c.score }))
      );

      const clusters: DigestClusterForEmail[] = (clusterRows ?? []).map((c) => {
        const clusterItems = (c.raw_item_ids as string[])
          .map((id) => itemById.get(id))
          .filter((item): item is NonNullable<ReturnType<typeof itemById.get>> => item !== undefined);

        // Build unique sources list (deduped by source ID, preserving order)
        const seen = new Set<string>();
        const uniqueSources: { name: string; url: string | null }[] = [];
        for (const item of clusterItems) {
          if (item._sourceId && !seen.has(item._sourceId)) {
            seen.add(item._sourceId);
            const src = sourceById.get(item._sourceId);
            if (src) uniqueSources.push(src);
          }
        }

        return {
          id: c.id,
          topic: c.topic,
          summary: c.summary,
          rank: c.rank,
          isFullBlock: fullBlockIds.has(c.id),
          // Strip the internal _sourceId field from the public items shape
          items: clusterItems.map(({ id, title, sourceUrl, sourceName }) => ({
            id, title, sourceUrl, sourceName,
          })),
          sources: uniqueSources,
        };
      });

      return { digest, clusters, userEmail: userRow.email };
    });

    // Idempotency: already sent
    if (!clusters.length && (digest as { status?: string }).status === "sent") {
      return { status: "already-sent", digest_id };
    }

    if (clusters.length === 0) {
      throw new Error(`digest ${digest_id} has no clusters — cannot send`);
    }

    // ── Step 2: Render HTML + plain text ──────────────────────────────────
    const { html, text } = await step.run("render", async () => {
      const periodDate = new Date(digest.period_end);
      const periodLabel = periodDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      const replyToAddress = `reply+${digest_id}@${config.postmark.replyDomain}`;
      const appUrl = config.app.url;
      const listenUrl = `${appUrl}/app/audio-briefs/${digest_id}`;

      return renderEmail(
        React.createElement(DigestEmail, {
          digestId: digest_id,
          subject: digest.subject ?? "Your Brief",
          periodLabel,
          clusters: clusters as DigestClusterForEmail[],
          userEmail,
          replyToAddress,
          unsubscribeUrl: `${appUrl}/app/preferences`,
          preferencesUrl: `${appUrl}/app/preferences`,
          appUrl,
          listenUrl,
        })
      );
    });

    // ── Step 3: Send via Postmark ─────────────────────────────────────────
    const { messageId } = await step.run("send", async () => {
      const replyTo = `reply+${digest_id}@${config.postmark.replyDomain}`;

      return sendEmail({
        to: userEmail,
        subject: digest.subject ?? "Your Brief",
        htmlBody: html,
        textBody: text,
        replyTo,
      });
    });

    // ── Step 4: Mark sent ─────────────────────────────────────────────────
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
        .eq("id", digest_id);
    });

    return { status: "sent", digest_id, messageId };
  }
);
