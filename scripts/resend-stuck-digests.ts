/**
 * Emergency resend script for stuck digests (status='ready', never emailed).
 *
 * Bypasses Inngest entirely — loads digest data from Supabase, renders the
 * email using the project's React Email template, sends via Postmark, then
 * marks each digest as 'sent'.
 *
 * Run from project root:
 *   LOAD_ENV=1 npx tsx scripts/resend-stuck-digests.ts
 *   -- or with a specific digest ID:
 *   DIGEST_ID=xxx LOAD_ENV=1 npx tsx scripts/resend-stuck-digests.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config as dotenv } from "dotenv";
import * as path from "path";
import * as React from "react";

// Load env vars from .env.local
dotenv({ path: path.join(process.cwd(), ".env.local") });

const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const POSTMARK_TOKEN     = process.env.POSTMARK_SERVER_TOKEN!;
const FROM_ADDRESS       = process.env.POSTMARK_FROM_ADDRESS ?? "brief@getupto.io";
const REPLY_DOMAIN       = process.env.POSTMARK_REPLY_DOMAIN ?? "inbound.getupto.io";
const APP_URL            = process.env.NEXT_PUBLIC_APP_URL ?? "https://getupto.io";
const DRY_RUN            = process.env.DRY_RUN === "1";
const TARGET_DIGEST_ID   = process.env.DIGEST_ID ?? null;

if (!SUPABASE_URL || !SUPABASE_KEY || !POSTMARK_TOKEN) {
  console.error("Missing required env vars — check .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Postmark send ─────────────────────────────────────────────────────────────

async function postmarkSend(opts: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  replyTo: string;
  tag?: string;
}): Promise<{ messageId: string }> {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": POSTMARK_TOKEN,
    },
    body: JSON.stringify({
      From: FROM_ADDRESS,
      To: opts.to,
      Subject: opts.subject,
      HtmlBody: opts.htmlBody,
      TextBody: opts.textBody,
      ReplyTo: opts.replyTo,
      MessageStream: "outbound",
      Tag: opts.tag ?? "digest",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postmark error ${res.status}: ${body}`);
  }
  const data = await res.json() as { MessageID: string };
  return { messageId: data.MessageID };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍  Loading stuck digests${TARGET_DIGEST_ID ? ` (${TARGET_DIGEST_ID})` : ""}…`);
  if (DRY_RUN) console.log("⚠️  DRY RUN — no emails will be sent\n");

  // 1. Load stuck digests
  let query = supabase
    .from("digests")
    .select("id, user_id, subject, plain_body, period_end, started_at")
    .eq("status", "ready")
    .order("started_at", { ascending: true });

  if (TARGET_DIGEST_ID) {
    query = query.eq("id", TARGET_DIGEST_ID);
  }

  const { data: digests, error } = await query;
  if (error) throw new Error(`Failed to load digests: ${error.message}`);
  if (!digests?.length) { console.log("No stuck digests found."); return; }

  console.log(`Found ${digests.length} stuck digest(s):\n`);
  for (const d of digests) {
    console.log(`  • ${d.id}  ${d.subject?.substring(0, 60)}…  (started ${d.started_at?.substring(0,10)})`);
  }
  console.log();

  // 2. For each digest: render + send + mark sent
  for (const digest of digests) {
    console.log(`\n📧  Processing ${digest.id}`);
    console.log(`    Subject : ${digest.subject}`);

    // Load user email
    const { data: userRow } = await supabase
      .from("users")
      .select("email")
      .eq("id", digest.user_id)
      .single();

    if (!userRow?.email) {
      console.error(`    ❌  No email for user ${digest.user_id} — skipping`);
      continue;
    }
    console.log(`    To      : ${userRow.email}`);

    // Load clusters
    const { data: clusters } = await supabase
      .from("topic_clusters")
      .select("id, topic, summary, rank, score, raw_item_ids")
      .eq("digest_id", digest.id)
      .order("rank", { ascending: true });

    if (!clusters?.length) {
      console.error(`    ❌  No clusters — skipping`);
      continue;
    }
    console.log(`    Clusters: ${clusters.length}`);

    // Load items for each cluster
    const allItemIds = clusters.flatMap((c) => c.raw_item_ids as string[]);
    const { data: items } = await supabase
      .from("raw_items")
      .select("id, subject, source_id, metadata")
      .in("id", allItemIds);

    const sourceIds = [...new Set((items ?? []).map((r) => r.source_id).filter(Boolean))] as string[];
    const { data: sources } = await supabase
      .from("sources")
      .select("id, name, url")
      .in("id", sourceIds);

    const sourceById = new Map((sources ?? []).map((s) => [s.id, { name: s.name, url: s.url ?? null }]));
    const itemById = new Map((items ?? []).map((item) => {
      const src = item.source_id ? (sourceById.get(item.source_id) ?? null) : null;
      return [item.id, {
        id: item.id,
        title: (item.subject ?? "").trim(),
        sourceUrl: (item.metadata as { source_url?: string })?.source_url ?? null,
        sourceName: src?.name ?? "Unknown",
        _sourceId: item.source_id ?? null,
      }];
    }));

    // Score-based full-block detection (top 30% by score gap = full block)
    const sorted = [...clusters].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const maxScore = sorted[0]?.score ?? 1;
    const fullBlockIds = new Set(sorted.filter((c) => (c.score ?? 0) / maxScore >= 0.7).map((c) => c.id));

    type ClusterForEmail = {
      id: string; topic: string; summary: string | null; rank: number;
      isFullBlock: boolean;
      items: { id: string; title: string; sourceUrl: string | null; sourceName: string }[];
      sources: { name: string; url: string | null }[];
    };

    const clustersForEmail: ClusterForEmail[] = clusters.map((c) => {
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
        id: c.id, topic: c.topic, summary: c.summary, rank: c.rank,
        isFullBlock: fullBlockIds.has(c.id),
        items: clusterItems.map(({ id, title, sourceUrl, sourceName }) => ({ id, title, sourceUrl, sourceName })),
        sources: uniqueSources,
      };
    });

    // Render HTML using React Email template
    let html: string;
    let text: string;
    try {
      // Dynamic import to avoid module resolution issues at top level
      const { renderEmail } = await import("../lib/email/render.js");
      const { DigestEmail } = await import("../lib/email/templates/digest.js");

      const periodLabel = new Date(digest.period_end).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      });
      const replyToAddress = `reply+${digest.id}@${REPLY_DOMAIN}`;
      const rendered = await renderEmail(
        React.createElement(DigestEmail as unknown as React.ComponentType<Record<string, unknown>>, {
          digestId: digest.id,
          subject: digest.subject ?? "Your Brief",
          periodLabel,
          clusters: clustersForEmail,
          userEmail: userRow.email,
          replyToAddress,
          unsubscribeUrl: `${APP_URL}/app/preferences`,
          preferencesUrl: `${APP_URL}/app/preferences`,
          appUrl: APP_URL,
          listenUrl: `${APP_URL}/app/audio-briefs/${digest.id}`,
        })
      );
      html = rendered.html;
      text = rendered.text;
      console.log(`    ✓ Rendered HTML (${html.length} chars)`);
    } catch (renderErr) {
      console.warn(`    ⚠️  HTML render failed (${renderErr instanceof Error ? renderErr.message : renderErr}) — falling back to plain_body`);
      // Fallback: wrap plain_body in minimal HTML
      text = digest.plain_body ?? "";
      html = `<pre style="font-family:sans-serif;white-space:pre-wrap;max-width:600px">${text}</pre>`;
    }

    if (DRY_RUN) {
      console.log(`    ✓ DRY RUN — would send to ${userRow.email}`);
      continue;
    }

    // Send via Postmark
    try {
      const replyTo = `reply+${digest.id}@${REPLY_DOMAIN}`;
      const { messageId } = await postmarkSend({
        to: userRow.email,
        subject: digest.subject ?? "Your Brief",
        htmlBody: html,
        textBody: text,
        replyTo,
        tag: "digest-resend",
      });
      console.log(`    ✓ Sent — Postmark MessageID: ${messageId}`);

      // Mark as sent
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
        .eq("id", digest.id);
      console.log(`    ✓ Marked as sent in DB`);
    } catch (sendErr) {
      console.error(`    ❌  Send failed: ${sendErr instanceof Error ? sendErr.message : sendErr}`);
    }
  }

  console.log("\n✅  Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
