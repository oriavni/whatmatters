import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

/** PATCH /api/sources/:id — pause/resume, rename, or retry fetch */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: source } = await supabase
    .from("sources")
    .select("id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { action, status, name } = body as {
    action?: "retry";
    status?: "active" | "paused";
    name?: string;
  };

  // ── Retry: reset to active + trigger immediate fetch ─────────────────────
  if (action === "retry") {
    await supabase
      .from("sources")
      .update({ status: "active", error_message: null })
      .eq("id", id);

    try {
      await inngest.send({
        name: "source/added",
        data: { source_id: id, user_id: user.id },
      });
    } catch {
      // Non-fatal — cron will pick it up on next run
    }

    return NextResponse.json({ id, action: "retry" });
  }

  // ── Status / rename update ────────────────────────────────────────────────
  const updates: Record<string, unknown> = {};
  if (status === "active" || status === "paused") updates.status = status;
  if (typeof name === "string" && name.trim()) updates.name = name.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase.from("sources").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id, updated: updates });
}

/** DELETE /api/sources/:id — remove a source */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership before deleting — same pattern as PATCH.
  // Without this, Supabase returns no error when 0 rows are deleted,
  // causing a false 200 when the source belongs to another user.
  const { data: source } = await supabase
    .from("sources")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("sources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id, deleted: true });
}
