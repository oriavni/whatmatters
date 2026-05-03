/**
 * PATCH /api/admin/freeze
 * Body: { user_id: string, is_frozen: boolean }
 *
 * Admin-only endpoint to freeze or unfreeze a user account.
 * Frozen users are blocked from generating digests/audio and from scheduled delivery.
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
  const { user_id, is_frozen } = body ?? {};

  if (!user_id || typeof is_frozen !== "boolean") {
    return NextResponse.json({ error: "user_id and is_frozen required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  // Type cast: is_frozen column added by migration 20260427000002;
  // TS types update after `supabase gen types` is re-run.
  const { error } = await (supabase
    .from("users")
    .update({ is_frozen } as Record<string, unknown>)
    .eq("id", user_id) as unknown as Promise<{ error: { message: string } | null }>);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_frozen });
}
