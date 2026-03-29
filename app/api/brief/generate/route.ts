import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";

/** POST /api/brief/generate — trigger on-demand digest generation */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Guard: no duplicate concurrent generations for the same user
  const { data: inProgress } = await service
    .from("digests")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["pending", "generating"])
    .limit(1)
    .maybeSingle();

  if (inProgress) {
    return NextResponse.json(
      { error: "A brief is already being generated", digest_id: inProgress.id },
      { status: 409 }
    );
  }

  // Guard: ensure the user has at least one processed item in the last 24h.
  // If the RSS feed was just added and hasn't been fetched yet, fail clearly
  // rather than silently starting a pipeline that will produce nothing.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from("raw_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_processed", true)
    .gte("received_at", since);

  if (!count || count === 0) {
    return NextResponse.json(
      {
        error:
          "No content has been fetched from your sources yet. Add a source and try again in a few minutes.",
      },
      { status: 422 }
    );
  }

  // Fire the Inngest digest generation event.
  // The function creates the digest row and handles the full pipeline.
  await inngest.send({
    name: "digest/generate",
    data: { user_id: user.id },
  });

  return NextResponse.json({ status: "generating" });
}
