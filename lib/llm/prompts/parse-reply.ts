/**
 * Reply-to-email command parsing prompt.
 *
 * V1 supports exactly 7 intents:
 *   ignore_topic     — show less of a topic in future digests
 *   more_topic       — show more of a topic
 *   read_original    — send original source link(s)
 *   change_schedule  — change delivery frequency / time
 *   read_now         — generate a fresh digest immediately
 *   mute_source      — pause a source permanently
 *   audio_brief      — generate an audio version of the digest
 *
 * If the intent is unclear, returns intent: null (triggers clarification reply).
 */

export type ReplyIntent =
  | "ignore_topic"
  | "more_topic"
  | "read_original"
  | "change_schedule"
  | "read_now"
  | "mute_source"
  | "audio_brief";

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

SUPPORTED INTENTS AND EXAMPLES:

  ignore_topic — user wants less of a topic in future digests
    Examples: "skip politics", "less crypto please", "ignore the Apple story",
              "I don't care about AI", "too much sports", "not interested in finance",
              "less about climate change", "stop showing me celebrity news"

  more_topic — user wants more coverage on a topic
    Examples: "more AI", "tell me more about the Fed decision", "I want more on startups",
              "keep covering the election", "more about this"

  read_original — user wants the original article link
    Examples: "send me the link", "where can I read more about OpenAI",
              "original source?", "got a link for that?"

  change_schedule — user wants to change when or how often digests arrive
    Examples: "switch to daily", "send at 9am", "every monday", "once a week on friday",
              "I want to receive digests every day at 20:00", "send me one every morning at 7",
              "weekly on tuesday at 8am"

  read_now — user wants a fresh digest generated immediately
    Examples: "read now", "give me today's brief", "refresh", "send me one now"

  mute_source — user wants to stop seeing content from a specific source
    Examples: "mute TechCrunch", "stop sending Bloomberg", "unsubscribe from The Verge",
              "don't include Hacker News anymore", "remove that newsletter",
              "mute this source", "stop sending me this newsletter", "I don't want this source"
    Note: if the user doesn't name a specific source (e.g. "mute this source"), set source to null.

  audio_brief — user wants to listen to an audio version of the digest
    Examples: "audio", "listen", "podcast this", "read it to me", "play it",
              "give me the audio version", "I want to listen", "narrate this",
              "האזן", "הקרא לי", "לשמוע", "תשמיע לי", "תקרא לי", "podcast"

RULES:
  - Set confidence to "high" when the intent is unambiguous.
  - Set confidence to "low" and intent to null when the reply is ambiguous, a question, or does not match any supported intent.
  - Extract topic (string) for: ignore_topic, more_topic, read_original. Use the user's words exactly; do not rephrase.
  - Extract source (string) for: mute_source, but only if a named source appears in the message. Set source to null when the user says something generic like "mute this source" or "stop this newsletter" without naming it.
  - Extract schedule (string) for: change_schedule. Copy the relevant phrase verbatim (e.g. "daily", "monday morning", "8am", "every day at 20:00").
  - Leave topic, source, schedule as null for: audio_brief, read_now.
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
