import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { FeedbackRequest, FeedbackEventType } from "@/types";

// Map app-level event types to the DB enum values
const DB_TYPE_MAP: Partial<Record<FeedbackEventType, "thumbs_up" | "thumbs_down" | "skip" | "save">> = {
  like: "thumbs_up",
  save: "save",
  pin: "save",        // stored as save; distinguished by cluster_id context
  ignore_topic: "skip",
};

/** POST /api/feedback — record a user feedback event on a cluster */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as FeedbackRequest;
  if (!body.event_type) {
    return NextResponse.json({ error: "event_type is required" }, { status: 400 });
  }

  const dbType = DB_TYPE_MAP[body.event_type];

  // Events without a DB mapping (open, click, read_original, expand, rate) are
  // acknowledged but not persisted in feedback_events.
  if (!dbType) {
    return NextResponse.json({ ok: true });
  }

  const service = createServiceClient();

  // ── Like: toggle thumbs_up in feedback_events ─────────────────────────────
  // Uses DELETE ALL (not DELETE one) so accumulated rows from pre-toggle
  // testing are cleared in a single operation rather than one-by-one.
  if (body.event_type === "like" && body.cluster_id) {
    const { count } = await service
      .from("feedback_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("cluster_id", body.cluster_id)
      .eq("type", "thumbs_up");

    if (count && count > 0) {
      // Already liked → unlike: delete ALL rows (clears duplicates too)
      await service
        .from("feedback_events")
        .delete()
        .eq("user_id", user.id)
        .eq("cluster_id", body.cluster_id)
        .eq("type", "thumbs_up");
      return NextResponse.json({ ok: true, active: false });
    } else {
      // Not liked → like
      const { error } = await service.from("feedback_events").insert({
        user_id: user.id,
        type: "thumbs_up",
        digest_id: body.digest_id ?? null,
        cluster_id: body.cluster_id,
        raw_item_id: body.raw_item_id ?? null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, active: true });
    }
  }

  // ── Ignore topic: multi-state suppression (1 → 2 → 3 → 0 → repeat) ──────
  //
  // Source of truth for the active suppression window is topic_suppressions.
  // feedback_events receives an immutable log entry on every click for future
  // recommendation work (suppress_level in metadata).
  //
  // Cycle: none→1 digest, 1→2 digests, 2→3 digests, 3→reset (0).
  if (body.event_type === "ignore_topic" && body.cluster_id && body.topic_label) {
    // Read current suppress level from the operational table
    const { data: existing } = await service
      .from("topic_suppressions")
      .select("suppress_level")
      .eq("user_id", user.id)
      .eq("topic", body.topic_label)
      .maybeSingle();

    const currentLevel = (existing?.suppress_level as number | null) ?? 0;
    const nextLevel = currentLevel < 3 ? currentLevel + 1 : 0;

    if (nextLevel === 0) {
      // Reset: remove suppression
      await service
        .from("topic_suppressions")
        .delete()
        .eq("user_id", user.id)
        .eq("topic", body.topic_label);
    } else {
      // Upsert: set new level + reset countdown
      await service.from("topic_suppressions").upsert(
        {
          user_id: user.id,
          topic: body.topic_label,
          source_cluster_id: body.cluster_id,
          suppress_level: nextLevel,
          digests_remaining: nextLevel,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,topic" }
      );
    }

    // Always log to feedback_events — immutable audit trail for future ML
    await service.from("feedback_events").insert({
      user_id: user.id,
      type: "skip",
      digest_id: body.digest_id ?? null,
      cluster_id: body.cluster_id,
      raw_item_id: body.raw_item_id ?? null,
      metadata: { suppress_level: nextLevel, topic: body.topic_label },
    });

    return NextResponse.json({ ok: true, suppress_level: nextLevel });
  }

  // ── Primary: record feedback_events (non-toggle events) ──────────────────
  const { error } = await service.from("feedback_events").insert({
    user_id: user.id,
    type: dbType,
    digest_id: body.digest_id ?? null,
    cluster_id: body.cluster_id ?? null,
    raw_item_id: body.raw_item_id ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Secondary: side-effects per event type ────────────────────────────────

  // Save → also write to saved_items so the cluster appears on /app/saved
  if (body.event_type === "save" && body.cluster_id) {
    await service
      .from("saved_items")
      .upsert(
        { user_id: user.id, cluster_id: body.cluster_id },
        { onConflict: "user_id,cluster_id", ignoreDuplicates: true }
      );
    // Non-fatal: if saved_items insert fails the feedback_event is already
    // written; the user will see an inconsistency at most, not a full error.
  }

  return NextResponse.json({ ok: true });
}
