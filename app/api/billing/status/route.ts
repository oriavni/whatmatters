/**
 * GET /api/billing/status
 *
 * Returns the current subscription plan and status for the authenticated user.
 * Response: { plan, status, cancel_at_period_end, current_period_end }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, cancel_at_period_end, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    plan: sub?.plan ?? "free",
    status: sub?.status ?? "active",
    cancel_at_period_end: sub?.cancel_at_period_end ?? false,
    current_period_end: sub?.current_period_end ?? null,
  });
}
