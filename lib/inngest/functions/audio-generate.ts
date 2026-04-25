/**
 * Generate an audio version of a digest using OpenAI TTS.
 * Triggered by: audio/generate event.
 *
 * Steps:
 *   1. mark-generating  — set status = 'generating'
 *   2. generate-tts     — call OpenAI TTS, upload MP3
 *   3. finalize         — set status = 'completed', store metadata
 *
 * onFailure: mark status = 'failed', store error_message
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { generateAudioForDigest } from "@/lib/audio/generate";

interface AudioGenerateEvent {
  audio_digest_id: string;
  user_id: string;
  digest_id: string;
}

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
    const { storagePath, fileSizeBytes } = await step.run(
      "generate-tts",
      () => generateAudioForDigest(user_id, digest_id)
    );

    // ── Step 3: Finalize ─────────────────────────────────────────────────
    await step.run("finalize", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("audio_digests")
        .update({
          status: "completed",
          storage_path: storagePath,
          file_size_bytes: fileSizeBytes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", audio_digest_id);
    });

    return { status: "completed", audio_digest_id, digest_id };
  }
);
