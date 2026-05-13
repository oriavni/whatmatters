import { createClient } from "@supabase/supabase-js";
import { config as dotenv } from "dotenv";
import * as path from "path";
dotenv({ path: path.join(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = "e718b2f5-0f75-4e05-a20f-26fea8a88090"; // oriavni@gmail.com

async function time(label: string, fn: () => Promise<unknown>) {
  const start = Date.now();
  await fn();
  console.log(`  ${label}: ${Date.now() - start}ms`);
}

async function main() {
  console.log("=== DB query timing for getCurrentBriefForUser ===\n");

  const t0 = Date.now();

  // Step 1: latest digest
  let digestId = "";
  await time("1. latest digest", async () => {
    const { data } = await supabase.from("digests")
      .select("id, subject, period_end, status, sent_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    digestId = data?.id ?? "";
  });

  // Step 2: clusters
  let clusterRows: { id: string; raw_item_ids: unknown }[] = [];
  await time("2. topic_clusters", async () => {
    const { data } = await supabase.from("topic_clusters")
      .select("id, topic, summary, rank, score, raw_item_ids")
      .eq("digest_id", digestId)
      .order("rank", { ascending: true });
    clusterRows = (data ?? []) as { id: string; raw_item_ids: unknown }[];
  });
  const allItemIds = clusterRows.flatMap((c) => c.raw_item_ids as string[]);
  console.log(`     → ${clusterRows.length} clusters, ${allItemIds.length} item IDs`);

  // Step 3: raw_items
  let items: { id: string; source_id: unknown }[] = [];
  await time("3. raw_items", async () => {
    const { data } = await supabase.from("raw_items")
      .select("id, source_id, metadata").in("id", allItemIds);
    items = (data ?? []) as { id: string; source_id: unknown }[];
  });
  const sourceIds = [...new Set(items.map((r) => r.source_id).filter(Boolean))];
  console.log(`     → ${items.length} items, ${sourceIds.length} unique sources`);

  // Step 4: sources
  await time("4. sources", async () => {
    await supabase.from("sources").select("id, name, url").in("id", sourceIds as string[]);
  });

  console.log(`\n  TOTAL (steps 1-4): ${Date.now() - t0}ms`);

  // Parallel: freshness
  const t1 = Date.now();
  await time("\n5. freshness (last digest + item count)", async () => {
    await Promise.all([
      supabase.from("digests").select("created_at").eq("user_id", userId)
        .in("status", ["ready","sent"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("raw_items").select("id", { count: "exact", head: true }).eq("user_id", userId)
    ]);
  });

  // interactions (deferred, client-side)
  const clusterIds = clusterRows.map((c) => c.id);
  await time("6. interactions (client-side, after paint)", async () => {
    await Promise.all([
      supabase.from("feedback_events").select("cluster_id").eq("user_id", userId).in("cluster_id", clusterIds),
      supabase.from("saved_items").select("cluster_id").eq("user_id", userId).in("cluster_id", clusterIds),
      supabase.from("topic_clusters").select("id, topic").in("id", clusterIds),
      supabase.from("topic_suppressions").select("topic, suppress_level").eq("user_id", userId).gt("digests_remaining", 0),
    ]);
  });

  // profile + sources count + subscription (parallel with digest fetch)
  await time("7. profile+sources+subscription (parallel w/ digest)", async () => {
    await Promise.all([
      supabase.from("users").select("inbound_slug, is_premium_override").eq("id", userId).single(),
      supabase.from("sources").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
      supabase.from("subscriptions").select("status").eq("user_id", userId).maybeSingle(),
    ]);
  });
}

main().catch(console.error);
