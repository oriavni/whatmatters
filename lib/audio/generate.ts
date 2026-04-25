/**
 * Core audio generation logic.
 *
 * Supports two rendering modes:
 *   - "dialogue"  (default) — converts the digest into a two-host news dialogue
 *     using GPT-4o-mini, then TTS each line with distinct voices (alloy / shimmer).
 *   - "read"      — legacy single-voice read-aloud using chunked TTS (voice: alloy).
 *
 * Results are uploaded to Supabase Storage (audio-briefs bucket).
 *
 * Returns: { storagePath, fileSizeBytes }
 */
import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/service";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Extensible rendering mode for audio brief generation. */
export type AudioMode = "dialogue" | "read";

export interface AudioGenerateResult {
  storagePath: string;
  fileSizeBytes: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TTS_CHUNK_SIZE = 3800; // chars — safely under the 4096 OpenAI TTS limit
const TTS_MODEL = "tts-1" as const;

/**
 * System prompt for the dialogue-generation step.
 *
 * Instructs GPT-4o-mini to rewrite a digest as a professional two-host
 * news dialogue.  Output must contain ONLY dialogue lines — no headings,
 * no stage directions, no markdown.
 */
const DIALOGUE_SYSTEM_PROMPT = `You are a professional news-dialogue scriptwriter. \
Your task is to convert a written news digest into a two-host spoken dialogue for audio broadcast.

Rules:
- There are exactly two hosts: HOST_A and HOST_B.
- Every single line must begin with either "HOST_A: " or "HOST_B: " (including the colon and space).
- HOST_A leads the broadcast: introduces each story, states the key facts, and provides transitions.
- HOST_B asks clarifying questions, supplies supporting context, and draws brief comparisons to broader trends.
- The tone is professional and authoritative — a morning news programme, not a podcast or casual chat.
- Do not use filler phrases like "Great point", "Absolutely", "Interesting", or "Definitely".
- Do not include any stage directions, scene descriptions, headings, bullet points, or markdown.
- Do not add any preamble or closing lines beyond what is in the source digest.
- Cover every story and fact present in the source text — do not omit or invent information.
- Target length: approximately 1.2 times the word count of the source text.
- Output ONLY the dialogue lines. Nothing before HOST_A's first line, nothing after the last line.`;

// ─── OpenAI client ───────────────────────────────────────────────────────────

/** Returns a fresh OpenAI client scoped to the current invocation. */
function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

/**
 * Clean plain_body for TTS:
 * - Remove markdown headings (## Topic)
 * - Collapse extra blank lines
 * - Remove bare URLs
 */
export function cleanForTTS(plainBody: string): string {
  return plainBody
    .replace(/^##\s+/gm, "")        // remove markdown headings
    .replace(/https?:\/\/\S+/g, "") // remove URLs
    .replace(/\n{3,}/g, "\n\n")     // collapse extra blank lines
    .trim();
}

/**
 * Split text into chunks at sentence boundaries, keeping each chunk <= maxChars.
 */
export function chunkText(text: string, maxChars = TTS_CHUNK_SIZE): string[] {
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

// ─── Dialogue helpers ─────────────────────────────────────────────────────────

/**
 * Calls GPT-4o-mini to convert a digest plain_body into a two-host dialogue
 * script.  Each output line starts with "HOST_A: " or "HOST_B: ".
 */
export async function generateDialogueScript(plainBody: string): Promise<string> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: DIALOGUE_SYSTEM_PROMPT },
      { role: "user", content: plainBody },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

/**
 * Splits a dialogue script into an ordered array of speaker/text pairs.
 * Lines that do not match either prefix are silently dropped.
 */
export function parseDialogueLines(
  script: string
): Array<{ speaker: "A" | "B"; text: string }> {
  const lines = script.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: Array<{ speaker: "A" | "B"; text: string }> = [];

  for (const line of lines) {
    if (line.startsWith("HOST_A: ")) {
      result.push({ speaker: "A", text: line.slice("HOST_A: ".length).trim() });
    } else if (line.startsWith("HOST_B: ")) {
      result.push({ speaker: "B", text: line.slice("HOST_B: ".length).trim() });
    }
    // Lines that don't match either prefix are intentionally skipped
  }

  return result;
}

// ─── TTS helpers ──────────────────────────────────────────────────────────────

type TTSVoice = "alloy" | "shimmer";

/**
 * Call OpenAI TTS for a single piece of text; returns the raw MP3 Buffer.
 */
async function ttsText(openai: OpenAI, text: string, voice: TTSVoice): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice,
    input: text,
    response_format: "mp3",
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Run TTS for an array of items in parallel batches.
 * Batching avoids hitting OpenAI rate limits while being much faster than
 * sequential processing (typical dialogue: ~40 lines → 8 batches of 5 instead
 * of 40 serial calls).
 */
async function ttsBatch<T extends { text: string; voice: TTSVoice }>(
  openai: OpenAI,
  items: T[],
  concurrency = 8
): Promise<Buffer[]> {
  const results: Buffer[] = new Array(items.length);
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const buffers = await Promise.all(
      batch.map(({ text, voice }) => ttsText(openai, text, voice))
    );
    buffers.forEach((buf, j) => { results[i + j] = buf; });
  }
  return results;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate an audio brief for a digest and upload it to Supabase Storage.
 *
 * @param userId   - The authenticated user's UUID
 * @param digestId - The digest row UUID
 * @param mode     - "dialogue" (default) uses a two-host news dialogue;
 *                   "read" falls back to plain single-voice TTS
 */
export async function generateAudioForDigest(
  userId: string,
  digestId: string,
  mode: AudioMode = "dialogue"
): Promise<AudioGenerateResult> {
  const supabase = createServiceClient();

  // 1. Load plain_body
  const { data: digest, error } = await supabase
    .from("digests")
    .select("plain_body")
    .eq("id", digestId)
    .single();

  if (error || !digest?.plain_body) {
    throw new Error(
      `generateAudio: digest not found or has no plain_body — ${error?.message}`
    );
  }

  // 2. Clean source text
  const cleaned = cleanForTTS(digest.plain_body);
  if (cleaned.length < 10) {
    throw new Error("generateAudio: digest body too short for TTS");
  }

  const openai = getOpenAI();
  const buffers: Buffer[] = [];

  if (mode === "dialogue") {
    // 3a. Generate dialogue script via LLM
    const script = await generateDialogueScript(cleaned);
    const lines = parseDialogueLines(script);

    if (lines.length === 0) {
      throw new Error("generateAudio: dialogue script produced no parseable lines");
    }

    // 4a. TTS all lines in parallel batches (order preserved)
    const items = lines.map((l) => ({
      text: l.text,
      voice: (l.speaker === "A" ? "alloy" : "shimmer") as TTSVoice,
    }));
    const batchedBuffers = await ttsBatch(openai, items);
    buffers.push(...batchedBuffers);
  } else {
    // 3b. "read" mode — chunk and TTS with a single voice, batched
    const chunks = chunkText(cleaned);
    const items = chunks.map((text) => ({ text, voice: "alloy" as TTSVoice }));
    const batchedBuffers = await ttsBatch(openai, items);
    buffers.push(...batchedBuffers);
  }

  // 5. Concatenate all MP3 buffers
  const combined = Buffer.concat(buffers);
  const fileSizeBytes = combined.length;

  // 6. Upload to Supabase Storage
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
