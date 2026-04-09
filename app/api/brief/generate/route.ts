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

  // Guard: ensure the user has at least one source. Without sources, generation
  // can still fire (orphaned raw_items survive source deletion) which produces
  // confusing results.
  const { count: sourceCount } = await service
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!sourceCount || sourceCount === 0) {
    return NextResponse.json(
      {
        error:
          "Add at least one source before generating a Brief.",
      },
      { status: 422 }
    );
  }

  // Guard: ensure the user has at least one ingested item within the past 7 days.
  // We intentionally do not filter by is_processed — RSS items are inserted as
  // processed=true, and newsletter items are marked processed=true by email-inbound.
  // Both are valid inputs; the digest pipeline handles further filtering.
  // A 7-day window accommodates weekly newsletters and slow feeds while still
  // preventing generation against fully stale sources.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from("raw_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("received_at", since);

  if (!count || count === 0) {
    return NextResponse.json(
      {
        error:
          "No content has been fetched from your sources yet. Add a source and wait a moment for the first fetch to complete, then try again.",
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
