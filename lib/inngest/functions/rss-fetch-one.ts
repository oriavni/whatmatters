/**
 * Fetch a single RSS source immediately after it is added.
 * Triggered by: source/added event.
 *
 * This is a one-time complement to the scheduled rss-fetch-all cron.
 * On failure the source row is marked status='error', but the source
 * is never deleted — the cron will retry on its next run.
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchRssFeed } from "@/lib/rss/fetch";
import { excerptText } from "@/lib/ingestion/clean-html";

interface SourceAddedEvent {
  source_id: string;
  user_id: string;
}

export const rssFetchOne = inngest.createFunction(
  {
    id: "rss-fetch-one",
    name: "Fetch RSS Feed (on add)",
    triggers: [{ event: "source/added" }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      // Only mark the source as error after ALL retries are exhausted
      const sourceId = (event.data.event as { data: SourceAddedEvent }).data.source_id;
      const supabase = createServiceClient();
      await supabase
        .from("sources")
        .update({ status: "error", error_message: error.message })
        .eq("id", sourceId);
    },
  },
  async ({ event, step }) => {
    const { source_id, user_id } = event.data as SourceAddedEvent;

    // ── Step 1: Load source ───────────────────────────────────────────────
    const source = await step.run("load-source", async () => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("sources")
        .select("id, url, name")
        .eq("id", source_id)
        .eq("user_id", user_id)
        .eq("type", "rss")
        .eq("status", "active")
        .maybeSingle();

      if (error) throw new Error(`load-source: ${error.message}`);
      return data;
    });

    if (!source?.url) {
      return { status: "skipped", reason: "source not found or not an active RSS source" };
    }

    // ── Step 2: Fetch, deduplicate, insert ───────────────────────────────
    const result = await step.run("fetch-and-insert", async () => {
      const supabase = createServiceClient();
      const now = new Date().toISOString();

      let feed;
      try {
        feed = await fetchRssFeed(source.url!);
      } catch (err) {
        throw new Error(`fetch: ${String(err)}`);
      }

      if (feed.items.length === 0) {
        await supabase
          .from("sources")
          .update({ last_fetched_at: now, error_message: null })
          .eq("id", source_id);
        return { status: "empty" as const, new_items: 0 };
      }

      // Deduplicate against any already-stored items for this source
      const { data: existing } = await supabase
        .from("raw_items")
        .select("metadata")
        .eq("source_id", source_id);

      const knownUrls = new Set(
        (existing ?? []).map(
          (r) => (r.metadata as { source_url?: string })?.source_url
        )
      );

      const newItems = feed.items.filter((item) => !knownUrls.has(item.url));

      if (newItems.length === 0) {
        await supabase
          .from("sources")
          .update({ last_fetched_at: now, error_message: null })
          .eq("id", source_id);
        return { status: "no-new-items" as const, new_items: 0 };
      }

      const rows = newItems.map((item) => ({
        user_id,
        source_id,
        source_type: "rss" as const,
        subject: item.title || null,
        received_at: item.published_at ?? now,
        body_text: item.content || null,
        summary: excerptText(item.content, 200) ?? item.title ?? null,
        is_processed: true,
        metadata: { source_url: item.url },
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("raw_items")
        .insert(rows)
        .select("id");

      if (insertError) throw new Error(`insert: ${insertError.message}`);

      await supabase
        .from("sources")
        .update({ last_fetched_at: now, status: "active", error_message: null })
        .eq("id", source_id);

      // Notify the digest engine
      const events = (inserted ?? []).map((row) => ({
        name: "item/ready" as const,
        data: { raw_item_id: row.id, user_id, source_type: "rss" },
      }));
      if (events.length > 0) await inngest.send(events);

      return { status: "ok" as const, new_items: newItems.length };
    });

    return { source_id, ...result };
  }
);
