/**
 * DELETE /api/account — deactivate (soft-delete) the authenticated user's account.
 *
 * Effect:
 *   1. Sets users.is_frozen = true   — immediately blocks all AI jobs and API routes
 *   2. Cancels any pending/generating digests
 *   3. Signs out the current session (client-side redirect handles the rest)
 *
 * This is a soft-delete: data is retained. Restoration requires admin action.
 * Hard auth deletion (if ever needed) can be done by an admin via the service role.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const now = new Date().toISOString();

  // 1. Freeze the account — this is the key enforcement step.
  //    All AI routes and Inngest functions check isUserFrozen() before proceeding.
  const { error: freezeError } = await (
    service
      .from("users")
      .update({ is_frozen: true } as Record<string, unknown>)
      .eq("id", user.id) as unknown as Promise<{ error: { message: string } | null }>
  );

  if (freezeError) {
    console.error("[DELETE /api/account] freeze failed:", freezeError.message);
    return NextResponse.json(
      { error: "Failed to deactivate account. Please try again." },
      { status: 500 }
    );
  }

  // 2. Cancel any in-progress or pending digests so they don't complete
  //    and consume LLM spend after the account is frozen.
  await service
    .from("digests")
    .update({
      status: "failed",
      error_message: "Account deactivated by user",
      finished_at: now,
    })
    .eq("user_id", user.id)
    .in("status", ["pending", "generating"]);

  // 3. Sign out the current session (best-effort — failure is non-fatal since
  //    is_frozen=true already blocks all future requests).
  await supabase.auth.signOut().catch((err) =>
    console.warn("[DELETE /api/account] signOut failed (non-fatal):", err)
  );

  return NextResponse.json({ status: "deactivated" });
}
