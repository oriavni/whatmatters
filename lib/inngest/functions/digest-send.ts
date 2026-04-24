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

      const { data: sources } = await supabase
        .from("sources")
        .select("id, name")
        .in("id", sourceIds);

      const sourceNameById = new Map<string, string>(
        (sources ?? []).map((s) => [s.id, s.name])
      );

      const itemById = new Map(
        (items ?? []).map((item) => ({
          id: item.id,
          title: (item.subject ?? "").trim(),
          sourceUrl: (item.metadata as { source_url?: string })?.source_url ?? null,
          sourceName: item.source_id
            ? (sourceNameById.get(item.source_id) ?? "Unknown")
            : "Unknown",
        })).map((item) => [item.id, item])
      );

      // Determine full-block set by score gap detection (importance, not position)
      const fullBlockIds = selectFullBlockIds(
        (clusterRows ?? []).map((c) => ({ id: c.id, score: c.score }))
      );

      const clusters: DigestClusterForEmail[] = (clusterRows ?? []).map((c) => ({
        id: c.id,
        topic: c.topic,
        summary: c.summary,
        rank: c.rank,
        isFullBlock: fullBlockIds.has(c.id),
        items: (c.raw_item_ids as string[])
          .map((id) => itemById.get(id))
          .filter((item): item is NonNullable<typeof item> => item !== undefined),
      }));

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
      await supabase
        .from("digests")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          postmark_message_id: messageId,
          html_body: html,
        })
        .eq("id", digest_id);
    });

    return { status: "sent", digest_id, messageId };
  }
);
