/**
 * Generate an audio version of a digest using OpenAI TTS.
 * Triggered by: audio/generate event.
 *
 * Steps:
 *   1. mark-generating  — set status = 'generating'
 *   2. generate-tts     — call OpenAI TTS, upload MP3
 *   3. finalize         — set status = 'completed', store metadata
 *   4. notify-email     — send "your audio is ready" email (best-effort)
 *
 * onFailure: mark status = 'failed', store error_message
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { generateAudioForDigest } from "@/lib/audio/generate";
import { sendEmail } from "@/lib/email/postmark";

interface AudioGenerateEvent {
  audio_digest_id: string;
  user_id: string;
  digest_id: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://www.getupto.io";

export const audioGenerate = inngest.createFunction(
  {
    id: "audio-generate",
    name: "Generate Audio Brief",
    triggers: [{ event: "audio/generate" }],
    retries: 1,
    timeouts: {
      finish: "3m", // hard ceiling — parallel TTS should complete well under 1 min
    },
    concurrency: {
      limit: 3, // TTS can run in parallel across users
    },
    onFailure: async ({ event, error }) => {
      const { audio_digest_id } = (event.data.event as { data: AudioGenerateEvent }).data;
      const supabase = createServiceClient();
      await supabase
        .from("audio_digests")
        .update({
          status: "failed",
          error_message: error?.message ?? "Unknown error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", audio_digest_id);
    },
  },
  async ({ event, step }) => {
    const { audio_digest_id, user_id, digest_id } =
      event.data as AudioGenerateEvent;

    // ── Step 1: Mark generating ───────────────────────────────────────────
    await step.run("mark-generating", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("audio_digests")
        .update({ status: "generating", updated_at: new Date().toISOString() })
        .eq("id", audio_digest_id);
    });

    // ── Step 2: Generate TTS + upload ─────────────────────────────────────
    const { storagePath, fileSizeBytes, durationSec } = await step.run(
      "generate-tts",
      () => generateAudioForDigest(user_id, digest_id)
    );

    // ── Step 3: Finalize ──────────────────────────────────────────────────
    await step.run("finalize", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("audio_digests")
        .update({
          status: "completed",
          storage_path: storagePath,
          file_size_bytes: fileSizeBytes,
          duration_sec: durationSec,
          updated_at: new Date().toISOString(),
        })
        .eq("id", audio_digest_id);
    });

    // ── Step 4: Notify user via email (best-effort — never fails the job) ─
    await step.run("notify-email", async () => {
      try {
        const supabase = createServiceClient();

        const [{ data: { user } }, { data: digest }] = await Promise.all([
          supabase.auth.admin.getUserById(user_id),
          supabase
            .from("digests")
            .select("subject")
            .eq("id", digest_id)
            .single(),
        ]);

        if (!user?.email) return;

        const subject = digest?.subject ?? "Your Brief";
        const listenUrl = `${APP_URL}/app/audio-briefs/${digest_id}`;

        await sendEmail({
          to: user.email,
          subject: "🎧 Your Audio Brief is ready",
          textBody: `Your audio brief is ready to listen.\n\n"${subject}"\n\nListen now: ${listenUrl}`,
          htmlBody: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fff;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <p style="font-size:13px;color:#888;margin:0 0 24px;">WhatMatters</p>
    <h2 style="font-size:18px;font-weight:600;margin:0 0 8px;color:#111;">🎧 Your Audio Brief is ready</h2>
    <p style="font-size:14px;color:#555;margin:0 0 24px;line-height:1.5;">${subject}</p>
    <a href="${listenUrl}"
       style="display:inline-block;padding:11px 22px;background:#111;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
      ▶ Listen Now
    </a>
  </div>
</body>
</html>`.trim(),
        });
      } catch {
        // Never let a failed email break the job
      }
    });

    return { status: "completed", audio_digest_id, digest_id };
  }
);
