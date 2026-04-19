/**
 * POST /webhooks/postmark — Postmark inbound email webhook.
 *
 * Routing logic:
 *   • To matches {inbound_slug}@{inbound_domain}
 *       → new newsletter/email → store raw item → fire email/inbound
 *   • To matches reply+{digest_id}@{reply_domain}
 *       → digest reply → fire email/reply.parse
 *
 * Security: Postmark inbound webhooks do not support custom headers in the UI.
 * We verify a shared secret passed as a `?secret=` query parameter in the URL.
 * The secret is POSTMARK_WEBHOOK_SECRET from env.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { config } from "@/lib/config";
import { processInboundEmail } from "@/lib/ingestion/process-inbound";
import { processReplyEmail } from "@/lib/ingestion/process-reply";

// ── Postmark inbound payload shape (relevant fields only) ─────────────────────
interface PostmarkInboundPayload {
  MessageID: string;
  From: string;
  FromFull?: { Email: string; Name: string };
  To: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Date?: string;
  OriginalRecipient?: string;
}

const REPLY_PATTERN = /^reply\+([0-9a-f-]{36})@/i;

export async function POST(request: NextRequest) {
  // ── 1. Verify shared secret (query param: ?secret=...) ────────────────────
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("secret") ?? "";

  if (!token || token !== config.postmark.webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse payload ───────────────────────────────────────────────────────
  let payload: PostmarkInboundPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toAddress = (payload.OriginalRecipient ?? payload.To ?? "").toLowerCase();

  // ── 3. Route: digest reply? ────────────────────────────────────────────────
  const replyMatch = REPLY_PATTERN.exec(toAddress);
  if (replyMatch) {
    // Check replies_disabled system flag
    const supabaseForFlag = createServiceClient();
    const { data: flagRow } = await supabaseForFlag
      .from("system_flags")
      .select("value")
      .eq("key", "replies_disabled")
      .maybeSingle();
    if (flagRow?.value === true) {
      console.log("[postmark/reply] replies_disabled flag is set — dropping reply");
      return NextResponse.json({ ok: true });
    }

    const digestId = replyMatch[1];
    const replyPayload = {
      digest_id: digestId,
      from_address: payload.From,
      raw_text: payload.TextBody ?? "",
      message_id: payload.MessageID,
    };
    console.log("[postmark/reply] firing email/reply.parse", replyPayload);
    try {
      await inngest.send({ name: "email/reply.parse", data: replyPayload });
      console.log("[postmark/reply] inngest.send ok");
    } catch (err) {
      console.error("[postmark/reply] inngest.send failed, running inline fallback:", err);
      try {
        await processReplyEmail(replyPayload);
        console.log("[postmark/reply] inline fallback ok");
      } catch (fallbackErr) {
        console.error("[postmark/reply] inline fallback also failed:", fallbackErr);
      }
    }
    return NextResponse.json({ ok: true });
  }

  // ── 4. Route: new inbound email ────────────────────────────────────────────
  // Resolve user from inbound slug (local part of the To address)
  const localPart = toAddress.split("@")[0];
  const supabase = createServiceClient();

  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("inbound_slug", localPart)
    .maybeSingle();

  if (!userRow) {
    // Unknown recipient — acknowledge to Postmark, silently drop
    console.warn("[postmark/inbound] unknown inbound_slug:", localPart);
    return NextResponse.json({ ok: true });
  }

  const userId = userRow.id;
  const senderEmail = payload.FromFull?.Email ?? payload.From ?? "";
  const senderName = payload.FromFull?.Name ?? "";
  const receivedAt = payload.Date
    ? new Date(payload.Date).toISOString()
    : new Date().toISOString();

  // ── 5. Insert raw_item row ─────────────────────────────────────────────────
  const { data: rawItem, error: insertError } = await supabase
    .from("raw_items")
    .insert({
      user_id: userId,
      source_type: "newsletter",
      subject: payload.Subject ?? null,
      sender_name: senderName || null,
      sender_email: senderEmail || null,
      received_at: receivedAt,
      body_text: payload.TextBody ?? null,
      is_processed: false,
      metadata: { postmark_message_id: payload.MessageID },
    })
    .select("id")
    .single();

  if (insertError || !rawItem) {
    console.error(
      "[postmark/inbound] failed to insert raw_item:",
      insertError?.message
    );
    // Return 200 so Postmark does not retry — the error is logged above
    return NextResponse.json({ ok: true });
  }

  // ── 6. Store raw HTML in Storage (if present) ──────────────────────────────
  if (payload.HtmlBody) {
    const storagePath = `${userId}/${rawItem.id}.html`;
    const { error: storageError } = await supabase.storage
      .from("raw-emails")
      .upload(storagePath, Buffer.from(payload.HtmlBody, "utf-8"), {
        contentType: "text/html",
        upsert: false,
      });

    if (storageError) {
      console.warn(
        "[postmark/inbound] storage upload failed:",
        storageError.message
      );
    } else {
      await supabase
        .from("raw_items")
        .update({ raw_html_path: storagePath })
        .eq("id", rawItem.id);
    }
  }

  // ── 7. Fire Inngest event ──────────────────────────────────────────────────
  const inboundPayload = {
    raw_item_id: rawItem.id,
    user_id: userId,
    sender_email: senderEmail,
    sender_name: senderName,
  };
  console.log("[postmark/inbound] firing email/inbound", inboundPayload);
  try {
    await inngest.send({ name: "email/inbound", data: inboundPayload });
    console.log("[postmark/inbound] inngest.send ok");
  } catch (err) {
    console.error("[postmark/inbound] inngest.send failed, running inline fallback:", err);
    try {
      await processInboundEmail(inboundPayload);
      console.log("[postmark/inbound] inline fallback ok");
    } catch (fallbackErr) {
      console.error("[postmark/inbound] inline fallback also failed:", fallbackErr);
    }
  }

  return NextResponse.json({ ok: true });
}
