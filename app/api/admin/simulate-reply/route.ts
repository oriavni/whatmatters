/**
 * POST /api/admin/simulate-reply
 *
 * Runs processReplyEmail inline for a given user + command text.
 * Uses the user's latest sent digest as context.
 * Sends a real confirmation email to the user's address — admin should be aware.
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/service";
import { processReplyEmail } from "@/lib/ingestion/process-reply";

function isAuthorized(request: NextRequest): boolean {
  const token = request.cookies.get("admin_token")?.value;
  return !!token && token === config.admin.secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user_id, command } = await request.json();
  if (!user_id || !command?.trim()) {
    return NextResponse.json({ error: "user_id and command required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Find user's latest sent digest
  const { data: digest } = await supabase
    .from("digests")
    .select("id")
    .eq("user_id", user_id)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!digest) {
    return NextResponse.json({ error: "No sent digest found for this user" }, { status: 404 });
  }

  // Get user email to use as from_address
  const { data: userRow } = await supabase
    .from("users")
    .select("email")
    .eq("id", user_id)
    .single();

  if (!userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await processReplyEmail({
    digest_id: digest.id,
    from_address: userRow.email,
    raw_text: command.trim(),
  });

  return NextResponse.json({ ok: true });
}
