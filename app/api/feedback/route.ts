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

  // ── Primary: record feedback_events ──────────────────────────────────────
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

  // Ignore → append topic label to user_preferences.ignored_topics so future
  // digest generation can suppress this topic for this user.
  if (body.event_type === "ignore_topic" && body.topic_label) {
    const { data: prefs } = await service
      .from("user_preferences")
      .select("ignored_topics")
      .eq("user_id", user.id)
      .single();

    const current: string[] = prefs?.ignored_topics ?? [];
    if (!current.includes(body.topic_label)) {
      await service
        .from("user_preferences")
        .update({ ignored_topics: [...current, body.topic_label] })
        .eq("user_id", user.id);
    }
    // Non-fatal: if preferences update fails the skip feedback_event is
    // already written; the topic will still be suppressible once the
    // cluster pipeline reads ignored_topics.
  }

  return NextResponse.json({ ok: true });
}
