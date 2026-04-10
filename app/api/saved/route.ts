import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** GET /api/saved — list the user's saved clusters */
export async function GET() {
  // Auth check with user client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use service client for the query so PostgREST RLS on the topic_clusters
  // FK join doesn't block results. Correct DB column names are topic + summary
  // (not label + synthesis — the TypeScript TopicCluster interface is misaligned).
  const service = createServiceClient();
  const { data, error } = await service
    .from("saved_items")
    .select(
      `
      id,
      created_at,
      cluster_id,
      topic_clusters (
        topic,
        summary
      )
    `
    )
    .eq("user_id", user.id)
    .not("cluster_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

/** DELETE /api/saved?id=<saved_item_id> — remove a saved item */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase
    .from("saved_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // RLS guard — users can only delete their own items

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
