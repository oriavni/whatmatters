/**
 * Process an inbound email.
 * Triggered by: email/inbound (fired from Postmark webhook).
 *
 * Steps:
 *   1. Load raw_item from DB
 *   2. Find or create the source (identifySource)
 *   3. Resolve body text — use Postmark TextBody if present, else clean stored HTML
 *   4. Generate a deterministic excerpt (no LLM — ingestion is decoupled from AI)
 *   5. Persist: update raw_item (body_text, summary, source_id, is_processed)
 *              + touch source.last_fetched_at
 *
 * LLM summarization happens later, during digest generation, not here.
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { identifySource } from "@/lib/ingestion/identify-source";
import { cleanHtml, excerptText, truncateText } from "@/lib/ingestion/clean-html";

interface EmailInboundEvent {
  raw_item_id: string;
  user_id: string;
  sender_email: string;
  sender_name: string;
}

export const emailInbound = inngest.createFunction(
  {
    id: "email-inbound",
    name: "Process Inbound Email",
    triggers: [{ event: "email/inbound" }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { raw_item_id, user_id, sender_email, sender_name } =
      event.data as EmailInboundEvent;

    // ── Step 1: Load raw item ────────────────────────────────────────────────
    const rawItem = await step.run("load-raw-item", async () => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("raw_items")
        .select("id, body_text, raw_html_path, subject, is_processed")
        .eq("id", raw_item_id)
        .single();
      if (error || !data) {
        throw new Error(`load-raw-item: ${error?.message ?? "not found"}`);
      }
      return data;
    });

    // Idempotency guard
    if (rawItem.is_processed) return { skipped: true };

    // ── Step 2: Find or create source ────────────────────────────────────────
    const { sourceId } = await step.run("identify-source", () =>
      identifySource(user_id, sender_email, sender_name)
    );

    // ── Step 3: Resolve body text ─────────────────────────────────────────────
    // Postmark populates body_text from its own TextBody extraction.
    // Only parse stored HTML as a fallback for HTML-only newsletters.
    const bodyText = await step.run("resolve-body-text", async () => {
      if (rawItem.body_text && rawItem.body_text.trim().length > 50) {
        return rawItem.body_text;
      }
      if (rawItem.raw_html_path) {
        const supabase = createServiceClient();
        const { data, error } = await supabase.storage
          .from("raw-emails")
          .download(rawItem.raw_html_path);
        if (!error && data) {
          return cleanHtml(await data.text());
        }
      }
      return rawItem.body_text ?? "";
    });

    // ── Step 4: Deterministic excerpt (no LLM) ────────────────────────────────
    // A short preview derived from cleaned text, used for digest card rendering
    // before the digest engine runs its own LLM pass.
    const summary = await step.run("build-excerpt", async () => {
      // Prefer text derived from the body; fall back to subject as last resort
      const source = bodyText.trim().length > 20
        ? bodyText
        : rawItem.subject ?? "";
      return excerptText(source, 200) ?? truncateText(source, 200) ?? null;
    });

    // ── Step 5: Persist ───────────────────────────────────────────────────────
    await step.run("persist-results", async () => {
      const supabase = createServiceClient();
      const now = new Date().toISOString();

      await Promise.all([
        supabase
          .from("raw_items")
          .update({
            source_id: sourceId,
            body_text: bodyText || null,
            summary,
            is_processed: true,
          })
          .eq("id", raw_item_id),

        supabase
          .from("sources")
          .update({ last_fetched_at: now })
          .eq("id", sourceId),
      ]);
    });

    return { raw_item_id, source_id: sourceId };
  }
);
