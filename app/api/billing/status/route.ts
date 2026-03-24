import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/billing/status — get current plan and subscription status */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // TODO (Prompt 4): query subscriptions table
  return NextResponse.json({ plan: "free", status: "active" });
}
