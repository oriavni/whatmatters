import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SAMPLE_CLUSTERS = [
  {
    topic: "AI models are getting faster and cheaper",
    summary:
      "Multiple labs shipped inference optimisations this week, cutting response latency by 30–50 % while reducing API costs. Smaller, distilled models are now competitive with last year's frontier on most benchmarks.",
    rank: 0,
    score: 0.95,
  },
  {
    topic: "Climate tech funding hits a record quarter",
    summary:
      "Global clean-energy startups raised $18 B in Q1 — the highest since 2021 — led by grid-storage and green-hydrogen projects. Analysts attribute the surge to the new federal tax-credit guidance released in February.",
    rank: 1,
    score: 0.88,
  },
  {
    topic: "Remote work policies are tightening again",
    summary:
      "Several large employers quietly updated return-to-office mandates this month, requiring three or four in-office days for most roles. Surveys show employee satisfaction dropping sharply at companies with strict mandates.",
    rank: 2,
    score: 0.80,
  },
  {
    topic: "Browser engines: WebGPU gains broad support",
    summary:
      "Firefox shipped WebGPU by default in its latest stable release, joining Chrome and Edge. Developers are already using it for in-browser ML inference and real-time 3-D rendering without native plugins.",
    rank: 3,
    score: 0.55,
  },
];

/** POST /api/brief/sample — insert a demo digest so new users can preview the Brief UI */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Delete any previous sample digest for this user so they always get a fresh one
  await service
    .from("digests")
    .delete()
    .eq("user_id", user.id)
    .contains("metadata", { is_sample: true });

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(now.getDate() - 1);

  const { data: digest, error: digestError } = await service
    .from("digests")
    .insert({
      user_id: user.id,
      status: "ready",
      period_start: periodStart.toISOString(),
      period_end: now.toISOString(),
      subject: "Your first Brief — sample edition",
      metadata: { is_sample: true },
    })
    .select("id")
    .single();

  if (digestError || !digest) {
    return NextResponse.json(
      { error: digestError?.message ?? "Failed to create sample digest" },
      { status: 500 }
    );
  }

  const clusterInserts = SAMPLE_CLUSTERS.map((c) => ({
    digest_id: digest.id,
    user_id: user.id,
    topic: c.topic,
    summary: c.summary,
    rank: c.rank,
    score: c.score,
    raw_item_ids: [] as string[],
  }));

  const { error: clustersError } = await service
    .from("topic_clusters")
    .insert(clusterInserts);

  if (clustersError) {
    return NextResponse.json({ error: clustersError.message }, { status: 500 });
  }

  return NextResponse.json({ digest_id: digest.id });
}
