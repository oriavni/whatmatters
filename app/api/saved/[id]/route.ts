import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** DELETE /api/saved/:id — unsave or unpin an item */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // TODO: delete saved_items row, verify ownership
  return NextResponse.json({ id, deleted: true });
}
