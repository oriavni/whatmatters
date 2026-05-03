/**
 * GET /api/audio/[digest_id]
 * Returns the audio brief status and a signed playback URL (if completed).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAudioSignedUrl } from "@/lib/audio/generate";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ digest_id: string }> }
) {
  const { digest_id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = createServiceClient();
  const { data: audioRow } = await serviceSupabase
    .from("audio_digests")
    .select("id, status, storage_path, duration_sec, file_size_bytes, error_message, created_at")
    .eq("user_id", user.id)
    .eq("digest_id", digest_id)
    .maybeSingle();

  if (!audioRow) {
    return NextResponse.json({ status: "not_found" });
  }

  // Auto-heal rows stuck in generating/pending longer than 10 minutes.
  // This covers cases where the Inngest job was never delivered or crashed
  // without triggering onFailure (e.g. worker restart, dev server down).
  const STALE_MS = 10 * 60 * 1000;
  const isStuck =
    (audioRow.status === "generating" || audioRow.status === "pending") &&
    Date.now() - new Date(audioRow.created_at).getTime() > STALE_MS;

  if (isStuck) {
    serviceSupabase
      .from("audio_digests")
      .update({
        status: "failed",
        error_message: "Generation timed out — please try again.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", audioRow.id)
      .then(() => {});
    return NextResponse.json({
      audio_digest_id: audioRow.id,
      status: "failed",
      audio_url: null,
      duration_sec: null,
      file_size_bytes: null,
      error_message: "Generation timed out — please try again.",
      created_at: audioRow.created_at,
    });
  }

  let audio_url: string | null = null;
  if (audioRow.status === "completed" && audioRow.storage_path) {
    audio_url = await getAudioSignedUrl(audioRow.storage_path);
  }

  return NextResponse.json({
    audio_digest_id: audioRow.id,
    status: audioRow.status,
    audio_url,
    duration_sec: audioRow.duration_sec,
    file_size_bytes: audioRow.file_size_bytes,
    error_message: audioRow.error_message,
    created_at: audioRow.created_at,
  });
}
