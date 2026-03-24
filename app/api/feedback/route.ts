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
  // acknowledged but not persisted in feedback_events — they'd need a separate
  // analytics table.
  if (!dbType) {
    return NextResponse.json({ ok: true });
  }

  const service = createServiceClient();
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

  return NextResponse.json({ ok: true });
}
