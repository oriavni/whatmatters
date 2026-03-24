import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/brief — list past digests (paginated) */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // TODO: query digests table for this user
  return NextResponse.json({ digests: [], total: 0 });
}
