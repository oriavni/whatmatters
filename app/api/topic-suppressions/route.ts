import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** GET /api/topic-suppressions — list user's active suppressions */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("topic_suppressions")
    .select("topic, suppress_level, digests_remaining, updated_at")
    .eq("user_id", user.id)
    .gt("digests_remaining", 0)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suppressions: data ?? [] });
}

/** DELETE /api/topic-suppressions?topic=X — remove a suppression immediately */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topic = new URL(request.url).searchParams.get("topic");
  if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("topic_suppressions")
    .delete()
    .eq("user_id", user.id)
    .eq("topic", topic);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
