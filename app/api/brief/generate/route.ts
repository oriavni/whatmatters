import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { checkTrialAllowed } from "@/lib/digest/trial";

/** POST /api/brief/generate — trigger on-demand digest generation */
export async function POST() {
  try {
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

  // Guard: frozen accounts cannot generate.
  const { isUserFrozen } = await import("@/lib/admin/freeze");
  if (await isUserFrozen(user.id)) {
    return NextResponse.json({ error: "Account suspended." }, { status: 403 });
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

  // Guard: ensure the user has at least one ingested item in the DB.
  // We use created_at (when the item landed in our system), NOT received_at
  // (the RSS publication date, which can be weeks old for backfill items).
  // This matches the freshness endpoint so the "You're ready" state and the
  // generate guard are always consistent.
  // The digest pipeline applies its own 24h received_at window; if nothing
  // falls inside that window, it returns a "no-items" failure gracefully.
  const { count } = await service
    .from("raw_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (!count || count === 0) {
    return NextResponse.json(
      {
        error:
          "No content has been fetched from your sources yet. Add a source and wait a moment for the first fetch to complete, then try again.",
      },
      { status: 422 }
    );
  }

  // Guard: trial limits — 3 digests within 3 days for non-active-paid users.
  const { allowed: trialAllowed, reason: trialReason } = await checkTrialAllowed(user.id, service);
  if (!trialAllowed) {
    const msg =
      trialReason === "trial_expired"
        ? "Your free trial has expired. Upgrade to keep generating Briefs."
        : "You've used all 3 Briefs included in your free trial. Upgrade to generate more.";
    return NextResponse.json({ error: msg, reason: trialReason }, { status: 403 });
  }

  // Fire the Inngest digest generation event.
  // The function creates the digest row and handles the full pipeline.
  await inngest.send({
    name: "digest/generate",
    data: {
      user_id: user.id,
      trigger: "on_demand" as const,
    },
  });

  return NextResponse.json({ status: "generating" });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/brief/generate] unhandled error:", message, err);
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
