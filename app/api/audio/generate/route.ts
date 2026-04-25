/**
 * POST /api/audio/generate
 * Body: { digest_id: string }
 *
 * Triggers audio generation for a digest.
 * Guards: auth, premium gate, monthly cap (20), idempotency.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { canGenerateAudio } from "@/lib/audio/premium";

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const digest_id = body?.digest_id as string | undefined;
  if (!digest_id) {
    return NextResponse.json({ error: "digest_id required" }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();

  // Verify digest belongs to user
  const { data: digest } = await serviceSupabase
    .from("digests")
    .select("id, user_id")
    .eq("id", digest_id)
    .eq("user_id", user.id)
    .single();

  if (!digest) {
    return NextResponse.json({ error: "Digest not found" }, { status: 404 });
  }

  // Idempotency: skip if already in-progress; allow retry if failed
  const { data: existing } = await serviceSupabase
    .from("audio_digests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("digest_id", digest_id)
    .maybeSingle();

  if (existing && existing.status !== "failed") {
    // Already pending/generating/completed — nothing to do
    return NextResponse.json({
      audio_digest_id: existing.id,
      status: existing.status,
      already_exists: true,
    });
  }

  // Premium + cap gate
  const { allowed, reason } = await canGenerateAudio(user.id);
  if (!allowed) {
    return NextResponse.json(
      {
        error: reason === "not_premium"
          ? "Audio Briefs are a premium feature. Upgrade to access."
          : "Monthly audio limit reached (20 per month).",
        reason,
      },
      { status: 403 }
    );
  }

  // Create or reset the audio_digests row
  let audioDigestId: string;
  if (existing?.status === "failed") {
    // Reset failed row so the user can retry
    const { error: updateError } = await serviceSupabase
      .from("audio_digests")
      .update({ status: "pending", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updateError) {
      return NextResponse.json(
        { error: `Failed to reset audio record: ${updateError.message}` },
        { status: 500 }
      );
    }
    audioDigestId = existing.id;
  } else {
    const { data: audioRow, error: insertError } = await serviceSupabase
      .from("audio_digests")
      .insert({ user_id: user.id, digest_id, status: "pending" })
      .select("id")
      .single();
    if (insertError || !audioRow) {
      return NextResponse.json(
        { error: `Failed to create audio record: ${insertError?.message}` },
        { status: 500 }
      );
    }
    audioDigestId = audioRow.id;
  }

  // Fire Inngest event
  try {
    await inngest.send({
      name: "audio/generate",
      data: { audio_digest_id: audioDigestId, user_id: user.id, digest_id },
    });
  } catch {
    // Inngest unavailable (e.g. dev server not running) — keep row as pending
    // so the user sees "Generating…" rather than a hard error. It won't
    // complete without the worker, but the row can be reset on next retry.
    return NextResponse.json(
      { error: "Could not connect to the audio worker. Check that the Inngest dev server is running." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    audio_digest_id: audioDigestId,
    status: "pending",
  });
}
