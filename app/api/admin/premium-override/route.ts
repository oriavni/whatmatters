/**
 * PATCH /api/admin/premium-override
 * Body: { user_id: string, is_premium_override: boolean }
 *
 * Admin-only endpoint to manually grant or revoke premium access.
 * Protected by admin_token cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cookies } from "next/headers";

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("admin_token")?.value;
  if (!adminToken || adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { user_id, is_premium_override } = body ?? {};

  if (!user_id || typeof is_premium_override !== "boolean") {
    return NextResponse.json({ error: "user_id and is_premium_override required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("users")
    .update({ is_premium_override })
    .eq("id", user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_premium_override });
}
