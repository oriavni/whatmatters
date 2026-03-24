import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { selectFullBlockIds } from "@/lib/digest/tier";

/** GET /api/brief/:id — fetch a specific digest by ID (ownership enforced) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: digest, error: digestError } = await service
    .from("digests")
    .select("id, subject, period_end, status, sent_at")
    .eq("id", id)
    .eq("user_id", user.id) // ownership check
    .in("status", ["ready", "sent"])
    .maybeSingle();

  if (digestError) {
    return NextResponse.json({ error: digestError.message }, { status: 500 });
  }
  if (!digest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load clusters
  const { data: clusterRows, error: clustersError } = await service
    .from("topic_clusters")
    .select("id, topic, summary, rank, score, raw_item_ids")
    .eq("digest_id", digest.id)
    .order("rank", { ascending: true });

  if (clustersError) {
    return NextResponse.json({ error: clustersError.message }, { status: 500 });
  }

  if (!clusterRows?.length) {
    return NextResponse.json({ digest: { ...digest, clusters: [] } });
  }

  // Resolve source names
  const allItemIds = clusterRows.flatMap((c) => c.raw_item_ids as string[]);

  const { data: items } = await service
    .from("raw_items")
    .select("id, source_id, metadata")
    .in("id", allItemIds);

  const sourceIds = [
    ...new Set((items ?? []).map((r) => r.source_id).filter(Boolean)),
  ] as string[];

  const { data: sources } = await service
    .from("sources")
    .select("id, name")
    .in("id", sourceIds);

  const sourceNameById = new Map((sources ?? []).map((s) => [s.id, s.name]));

  const itemById = new Map(
    (items ?? []).map((item) => [
      item.id,
      {
        sourceId: item.source_id as string | null,
        sourceName: item.source_id
          ? (sourceNameById.get(item.source_id) ?? "Unknown")
          : "Unknown",
        sourceUrl:
          (item.metadata as { source_url?: string })?.source_url ?? null,
      },
    ])
  );

  const fullBlockIds = selectFullBlockIds(
    clusterRows.map((c) => ({ id: c.id, score: c.score }))
  );

  const clusters = clusterRows.map((c) => {
    const itemDetails = (c.raw_item_ids as string[])
      .map((id) => itemById.get(id))
      .filter(
        (
          item
        ): item is {
          sourceId: string | null;
          sourceName: string;
          sourceUrl: string | null;
        } => item !== undefined
      );

    const seen = new Set<string>();
    const uniqueSources: { id: string; name: string }[] = [];
    for (const item of itemDetails) {
      if (item.sourceId && !seen.has(item.sourceId)) {
        seen.add(item.sourceId);
        uniqueSources.push({ id: item.sourceId, name: item.sourceName });
      }
    }

    return {
      id: c.id,
      topic: c.topic,
      summary: c.summary as string | null,
      rank: c.rank,
      isFullBlock: fullBlockIds.has(c.id),
      sources: uniqueSources,
      sourceUrl: itemDetails[0]?.sourceUrl ?? null,
    };
  });

  const periodLabel = new Date(digest.period_end).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return NextResponse.json({
    digest: {
      id: digest.id,
      subject: digest.subject,
      periodLabel,
      status: digest.status,
      sentAt: digest.sent_at,
      clusters,
    },
  });
}
