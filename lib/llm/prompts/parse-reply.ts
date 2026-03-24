/**
 * Reply-to-email command parsing prompt.
 *
 * V1 supports exactly 6 intents:
 *   ignore_topic     — show less of a topic in future digests
 *   more_topic       — show more of a topic
 *   read_original    — send original source link(s)
 *   change_schedule  — change delivery frequency / time
 *   read_now         — generate a fresh digest immediately
 *   mute_source      — pause a source permanently
 *
 * If the intent is unclear, returns intent: null (triggers clarification reply).
 */

export type ReplyIntent =
  | "ignore_topic"
  | "more_topic"
  | "read_original"
  | "change_schedule"
  | "read_now"
  | "mute_source";

export interface ParsedReply {
  intent: ReplyIntent | null;
  /** For ignore_topic / more_topic / read_original — the topic the user referenced */
  topic: string | null;
  /** For mute_source — the source name the user referenced */
  source: string | null;
  /** For change_schedule — raw schedule phrase (e.g. "daily", "monday 8am") */
  schedule: string | null;
  confidence: "high" | "low";
}

const SYSTEM = `You are a command classifier for "Brief", a personal newsletter digest product.

The user has replied to their Brief email. Classify their reply into exactly one of these intents, then extract relevant entities. Return a single JSON object — no prose, no markdown.

SUPPORTED INTENTS:
  ignore_topic     — user wants less of a topic (e.g. "skip politics", "less crypto please", "ignore the Apple story")
  more_topic       — user wants more on a topic (e.g. "more AI", "tell me more about the Fed decision")
  read_original    — user wants the original source link (e.g. "send me the link", "where can I read more about OpenAI")
  change_schedule  — user wants to change delivery time or frequency (e.g. "switch to daily", "send at 9am", "every monday")
  read_now         — user wants a fresh digest generated right now (e.g. "read now", "give me today's brief", "refresh")
  mute_source      — user wants to stop seeing content from a source (e.g. "mute TechCrunch", "stop sending Bloomberg")

RULES:
  - Set confidence to "high" when the intent is unambiguous.
  - Set confidence to "low" and intent to null when the reply is ambiguous, a question, or does not match any supported intent.
  - Extract topic (string) for: ignore_topic, more_topic, read_original. Use the user's words exactly; do not rephrase.
  - Extract source (string) for: mute_source. Use the source name as the user wrote it.
  - Extract schedule (string) for: change_schedule. Copy the relevant phrase verbatim (e.g. "daily", "monday morning", "8am").
  - Leave unneeded fields as null.

RESPONSE FORMAT (strict JSON):
{
  "intent": "<intent or null>",
  "topic": "<topic string or null>",
  "source": "<source name or null>",
  "schedule": "<schedule phrase or null>",
  "confidence": "high" | "low"
}`;

export function buildReplyParsingPrompt(replyText: string): { system: string; user: string } {
  return {
    system: SYSTEM,
    user: `Reply text:\n${replyText.trim()}`,
  };
}
