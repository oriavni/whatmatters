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

  // Idempotency: return existing if already requested
  const { data: existing } = await serviceSupabase
    .from("audio_digests")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("digest_id", digest_id)
    .maybeSingle();

  if (existing) {
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

  // Create audio_digests row
  const { data: audioRow, error: insertError } = await serviceSupabase
    .from("audio_digests")
    .insert({
      user_id: user.id,
      digest_id,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !audioRow) {
    return NextResponse.json(
      { error: `Failed to create audio record: ${insertError?.message}` },
      { status: 500 }
    );
  }

  // Fire Inngest event
  try {
    await inngest.send({
      name: "audio/generate",
      data: {
        audio_digest_id: audioRow.id,
        user_id: user.id,
        digest_id,
      },
    });
  } catch (err) {
    // Inngest unavailable — mark failed so user can retry
    await serviceSupabase
      .from("audio_digests")
      .update({ status: "failed", error_message: "Failed to queue generation" })
      .eq("id", audioRow.id);

    return NextResponse.json(
      { error: "Failed to queue audio generation. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    audio_digest_id: audioRow.id,
    status: "pending",
  });
}
