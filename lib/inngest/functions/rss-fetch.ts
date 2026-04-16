/**
 * Fetch all active RSS sources for all users.
 * Cron: every 30 minutes.
 *
 * For each active RSS source:
 *   1. Fetch + parse the feed
 *   2. Deduplicate items against existing raw_items (by source_url in metadata)
 *   3. Insert new raw_items — marked is_processed:true (RSS is pre-cleaned)
 *   4. Fire item/ready for each new item (consumed by digest generation)
 *   5. Update source.last_fetched_at; on fetch error set status = 'error'
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchRssFeed } from "@/lib/rss/fetch";
import { excerptText } from "@/lib/ingestion/clean-html";

export const rssFetchAll = inngest.createFunction(
  {
    id: "rss-fetch-all",
    name: "Fetch All RSS Feeds",
    triggers: [{ cron: "*/30 * * * *" }],
    concurrency: { limit: 5 },
  },
  async ({ step }) => {
    // ── Load all active RSS sources (all users) ───────────────────────────────
    const sources = await step.run("load-rss-sources", async () => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("sources")
        .select("id, user_id, url, name")
        .eq("type", "rss")
        .in("status", ["active", "error"])
        .not("url", "is", null);
      if (error) throw new Error(`load-rss-sources: ${error.message}`);
      return data ?? [];
    });

    if (sources.length === 0) return { processed: 0 };

    // ── Process each source — individual steps for Inngest checkpointing ───────
    const results = await Promise.allSettled(
      sources.map((source) =>
        step.run(`fetch-source-${source.id}`, async () => {
          const supabase = createServiceClient();
          const now = new Date().toISOString();

          // Fetch the feed
          let feed;
          try {
            feed = await fetchRssFeed(source.url!);
          } catch (err) {
            await supabase
              .from("sources")
              .update({ status: "error", error_message: String(err) })
              .eq("id", source.id);
            return { source_id: source.id, status: "error" as const };
          }

          if (feed.items.length === 0) {
            await supabase
              .from("sources")
              .update({ last_fetched_at: now, status: "active", error_message: null })
              .eq("id", source.id);
            return { source_id: source.id, status: "empty" as const };
          }

          // Deduplicate: load all known source_urls for this source
          const { data: existing } = await supabase
            .from("raw_items")
            .select("metadata")
            .eq("source_id", source.id);

          const knownUrls = new Set(
            (existing ?? []).map(
              (r) => (r.metadata as { source_url?: string })?.source_url
            )
          );

          const newItems = feed.items.filter((item) => !knownUrls.has(item.url));

          if (newItems.length === 0) {
            await supabase
              .from("sources")
              .update({ last_fetched_at: now, status: "active", error_message: null })
              .eq("id", source.id);
            return { source_id: source.id, status: "no-new-items" as const };
          }

          // Insert new raw_items
          const rows = newItems.map((item) => ({
            user_id: source.user_id,
            source_id: source.id,
            source_type: "rss" as const,
            subject: item.title || null,
            received_at: item.published_at ?? now,
            body_text: item.content || null,
            summary: excerptText(item.content, 200) ?? item.title ?? null,
            is_processed: true, // RSS items don't need a separate cleaning step
            metadata: { source_url: item.url },
          }));

          const { data: inserted, error: insertError } = await supabase
            .from("raw_items")
            .insert(rows)
            .select("id");

          if (insertError) throw new Error(`insert: ${insertError.message}`);

          // Touch source
          await supabase
            .from("sources")
            .update({ last_fetched_at: now, status: "active", error_message: null })
            .eq("id", source.id);

          // Fire item/ready for each new item — consumed by digest engine
          const events = (inserted ?? []).map((row) => ({
            name: "item/ready" as const,
            data: {
              raw_item_id: row.id,
              user_id: source.user_id,
              source_type: "rss",
            },
          }));
          if (events.length > 0) await inngest.send(events);

          return {
            source_id: source.id,
            status: "ok" as const,
            new_items: newItems.length,
          };
        })
      )
    );

    const { ok, failed } = results.reduce(
      (acc, r) => {
        r.status === "fulfilled" ? acc.ok++ : acc.failed++;
        return acc;
      },
      { ok: 0, failed: 0 }
    );

    return { processed: sources.length, ok, failed };
  }
);
