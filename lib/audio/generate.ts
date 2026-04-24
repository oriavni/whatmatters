/**
 * Core audio generation logic.
 *
 * Converts a digest's plain_body to an MP3 using OpenAI TTS (tts-1, alloy voice).
 * Chunks text at sentence boundaries to stay within the 4096-char API limit.
 * Stitches chunks and uploads the final MP3 to Supabase Storage (audio-briefs bucket).
 *
 * Returns: { storagePath, durationSec, fileSizeBytes }
 */
import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/service";

const TTS_CHUNK_SIZE = 3800; // chars — safely under the 4096 limit
const TTS_MODEL = "tts-1";
const TTS_VOICE = "alloy" as const;

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Clean plain_body for TTS:
 * - Remove markdown headings (## Topic)
 * - Collapse extra blank lines
 * - Remove URLs
 */
function cleanForTTS(plainBody: string): string {
  return plainBody
    .replace(/^##\s+/gm, "")           // remove markdown headings
    .replace(/https?:\/\/\S+/g, "")    // remove URLs
    .replace(/\n{3,}/g, "\n\n")        // collapse extra blank lines
    .trim();
}

/**
 * Split text into chunks at sentence boundaries, keeping each chunk <= maxChars.
 */
function chunkText(text: string, maxChars = TTS_CHUNK_SIZE): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Call OpenAI TTS for a single chunk; returns the raw MP3 Buffer.
 */
async function ttsChunk(openai: OpenAI, text: string): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: text,
    response_format: "mp3",
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export interface AudioGenerateResult {
  storagePath: string;
  fileSizeBytes: number;
}

export async function generateAudioForDigest(
  userId: string,
  digestId: string
): Promise<AudioGenerateResult> {
  const supabase = createServiceClient();

  // 1. Load plain_body
  const { data: digest, error } = await supabase
    .from("digests")
    .select("plain_body")
    .eq("id", digestId)
    .single();

  if (error || !digest?.plain_body) {
    throw new Error(`generateAudio: digest not found or has no plain_body — ${error?.message}`);
  }

  // 2. Clean + chunk
  const cleaned = cleanForTTS(digest.plain_body);
  if (cleaned.length < 10) {
    throw new Error("generateAudio: digest body too short for TTS");
  }
  const chunks = chunkText(cleaned);

  // 3. Generate TTS for each chunk
  const openai = getOpenAI();
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const buf = await ttsChunk(openai, chunk);
    buffers.push(buf);
  }

  // 4. Concatenate MP3 buffers
  const combined = Buffer.concat(buffers);
  const fileSizeBytes = combined.length;

  // 5. Upload to Supabase Storage
  const storagePath = `${userId}/${digestId}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from("audio-briefs")
    .upload(storagePath, combined, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`generateAudio: upload failed — ${uploadError.message}`);
  }

  return { storagePath, fileSizeBytes };
}

/**
 * Get a signed URL for an audio brief (valid for 7 days).
 */
export async function getAudioSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.storage
    .from("audio-briefs")
    .createSignedUrl(storagePath, 7 * 24 * 60 * 60); // 7 days
  return data?.signedUrl ?? null;
}
