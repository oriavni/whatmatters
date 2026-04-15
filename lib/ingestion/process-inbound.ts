/**
 * processInboundEmail — inline fallback for email-inbound Inngest function.
 *
 * Called directly from the Postmark webhook when inngest.send() is unavailable
 * (e.g. no cloud INNGEST_EVENT_KEY in production). Identical logic to the
 * email-inbound Inngest function, minus the step/retry wrapper.
 *
 * No LLM calls — pure DB + HTML cleanup. Safe to run synchronously in a
 * webhook handler (typically completes in < 3s).
 */
import { createServiceClient } from "@/lib/supabase/service";
import { identifySource } from "@/lib/ingestion/identify-source";
import { cleanHtml, excerptText, truncateText } from "@/lib/ingestion/clean-html";

export async function processInboundEmail({
  raw_item_id,
  user_id,
  sender_email,
  sender_name,
}: {
  raw_item_id: string;
  user_id: string;
  sender_email: string;
  sender_name: string;
}): Promise<void> {
  const supabase = createServiceClient();

  // 1. Load raw item
  const { data: rawItem, error: loadError } = await supabase
    .from("raw_items")
    .select("id, body_text, raw_html_path, subject, is_processed")
    .eq("id", raw_item_id)
    .single();

  if (loadError || !rawItem) {
    throw new Error(`processInboundEmail: load failed — ${loadError?.message ?? "not found"}`);
  }

  // Idempotency guard
  if (rawItem.is_processed) {
    console.log("[process-inbound] already processed, skipping:", raw_item_id);
    return;
  }

  // 2. Find or create source
  const { sourceId } = await identifySource(user_id, sender_email, sender_name);

  // 3. Resolve body text
  let bodyText = rawItem.body_text ?? "";
  if (!bodyText || bodyText.trim().length <= 50) {
    if (rawItem.raw_html_path) {
      const { data, error } = await supabase.storage
        .from("raw-emails")
        .download(rawItem.raw_html_path);
      if (!error && data) {
        bodyText = cleanHtml(await data.text());
      }
    }
  }

  // 4. Build excerpt (no LLM)
  const source = bodyText.trim().length > 20 ? bodyText : rawItem.subject ?? "";
  const summary = excerptText(source, 200) ?? truncateText(source, 200) ?? null;

  // 5. Persist
  const now = new Date().toISOString();
  await Promise.all([
    supabase
      .from("raw_items")
      .update({ source_id: sourceId, body_text: bodyText || null, summary, is_processed: true })
      .eq("id", raw_item_id),
    supabase
      .from("sources")
      .update({ last_fetched_at: now })
      .eq("id", sourceId),
  ]);

  console.log("[process-inbound] completed:", { raw_item_id, sourceId });
}
