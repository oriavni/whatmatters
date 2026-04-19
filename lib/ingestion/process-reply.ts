/**
 * processReplyEmail — inline fallback for email-reply-parse Inngest function.
 *
 * Called directly from the Postmark webhook when inngest.send() is unavailable
 * (e.g. INNGEST_EVENT_KEY not set in production). Identical logic to the
 * email-reply-parse Inngest function, minus the step/retry wrappers.
 *
 * Note: For "more_topic" and "read_now" intents, this fallback cannot queue a
 * fresh digest (that requires Inngest). All other intents (ignore_topic,
 * read_original, change_schedule, mute_source) are fully handled inline.
 * The confirmation email is always sent.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { generate } from "@/lib/llm/client";
import { buildReplyParsingPrompt, type ParsedReply } from "@/lib/llm/prompts/parse-reply";
import { sendEmail } from "@/lib/email/postmark";
import { config } from "@/lib/config";

// ── Re-used helpers (duplicated from email-reply.ts to avoid circular imports) ──

const DAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday",
] as const;

function parseScheduleString(scheduleStr: string): {
  digest_frequency?: string;
  digest_time?: string;
  digest_day?: number | null;
} {
  const lower = scheduleStr.toLowerCase();
  const result: { digest_frequency?: string; digest_time?: string; digest_day?: number | null } = {};

  if (lower.includes("daily") || lower.includes("every day")) {
    result.digest_frequency = "daily";
    result.digest_day = null;
  } else if (lower.includes("weekly") || lower.includes("once a week")) {
    result.digest_frequency = "weekly";
  }

  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (lower.includes(DAY_NAMES[i])) {
      result.digest_frequency = "weekly";
      result.digest_day = i;
      break;
    }
  }

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] ?? "0", 10);
    const ampm = timeMatch[3];
    if (ampm === "pm" && hours !== 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    if (hours >= 0 && hours < 24) {
      result.digest_time = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }
  }

  return result;
}

function matchCluster(
  topic: string,
  clusters: { id: string; topic: string; sourceUrl: string | null }[]
): { id: string; topic: string; sourceUrl: string | null } | null {
  const lower = topic.toLowerCase();
  const wordBoundary = new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const exact = clusters.find((c) => wordBoundary.test(c.topic));
  if (exact) return exact;

  const words = lower.split(/\s+/).filter((w) => w.length > 3);
  return (
    clusters.find((c) =>
      words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(c.topic))
    ) ?? null
  );
}

function confirmationText(
  parsed: ParsedReply,
  extras: {
    sourceUrl?: string | null;
    clusterTopic?: string | null;
    scheduleSummary?: string | null;
    sourceName?: string | null;
    digestQueued?: boolean;
  }
): { subject: string; text: string } {
  switch (parsed.intent) {
    case "ignore_topic":
      return {
        subject: "Brief: topic ignored",
        text: `Got it — I'll show less on "${extras.clusterTopic ?? parsed.topic}" in future digests.`,
      };
    case "more_topic":
      return {
        subject: "Brief: noted",
        text: extras.digestQueued
          ? `On it — I've queued a fresh digest. You'll receive it shortly.`
          : `Got it — I'll prioritise "${extras.clusterTopic ?? parsed.topic}" in your next digest.`,
      };
    case "read_original":
      return {
        subject: "Brief: original link",
        text: extras.sourceUrl
          ? `Here's the original article:\n${extras.sourceUrl}`
          : `I couldn't find the original link for "${parsed.topic}". It may not have been included in this digest.`,
      };
    case "change_schedule":
      return {
        subject: "Brief: schedule updated",
        text: extras.scheduleSummary
          ? `Done — ${extras.scheduleSummary}.`
          : `I updated your schedule based on your request. Reply again if you'd like to adjust.`,
      };
    case "read_now":
      return {
        subject: "Brief: noted",
        text: extras.digestQueued
          ? `Your fresh Brief is being generated. Check your inbox in a few minutes.`
          : `I've noted your request. Your next digest will arrive at your scheduled time.`,
      };
    case "mute_source":
      return {
        subject: "Brief: source muted",
        text: `Done — "${extras.sourceName ?? parsed.source}" has been muted and won't appear in future digests.`,
      };
    default:
      return {
        subject: "Brief: quick question",
        text: [
          "I wasn't sure what you meant. Here are the things you can reply with:",
          "",
          "  • \"more [topic]\" — get more coverage of a topic",
          "  • \"ignore [topic]\" — see less of a topic",
          "  • \"link to [topic]\" — get the original article link",
          "  • \"mute [source name]\" — stop seeing content from a source",
          "  • \"read now\" — generate a fresh digest right now",
          "  • \"daily\" / \"weekly on monday\" — change your delivery schedule",
        ].join("\n"),
      };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function processReplyEmail({
  digest_id,
  from_address,
  raw_text,
}: {
  digest_id: string;
  from_address: string;
  raw_text: string;
}): Promise<void> {
  const supabase = createServiceClient();

  // ── 1. Load context ─────────────────────────────────────────────────────────
  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .select("user_id, subject")
    .eq("id", digest_id)
    .single();

  if (digestError || !digest) {
    throw new Error(`process-reply: digest not found — ${digestError?.message}`);
  }

  const userId = digest.user_id;

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  if (userError || !userRow) {
    throw new Error(`process-reply: user not found — ${userError?.message}`);
  }

  const { data: clusterRows } = await supabase
    .from("topic_clusters")
    .select("id, topic, raw_item_ids")
    .eq("digest_id", digest_id)
    .order("rank", { ascending: true });

  const allItemIds = (clusterRows ?? []).flatMap((c) => c.raw_item_ids as string[]);
  const { data: items } = await supabase
    .from("raw_items")
    .select("id, metadata")
    .in("id", allItemIds);

  const sourceUrlById = new Map(
    (items ?? []).map((item) => [
      item.id,
      (item.metadata as { source_url?: string })?.source_url ?? null,
    ])
  );

  const clusters = (clusterRows ?? []).map((c) => ({
    id: c.id,
    topic: c.topic,
    sourceUrl:
      (c.raw_item_ids as string[])
        .map((id) => sourceUrlById.get(id) ?? null)
        .find((url) => url !== null) ?? null,
  }));

  // ── 2. Parse intent via LLM ─────────────────────────────────────────────────
  let parsed: ParsedReply;
  try {
    const prompt = buildReplyParsingPrompt(raw_text);
    const response = await generate(
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      {
        model: config.llm.replyParsingModel,
        temperature: 0,
        responseFormat: "json_object",
      }
    );
    parsed = JSON.parse(response.content) as ParsedReply;
  } catch {
    parsed = { intent: null, topic: null, source: null, schedule: null, confidence: "low" };
  }

  // ── 3. Execute action ───────────────────────────────────────────────────────
  const DB_ACTION_MAP: Record<
    NonNullable<ParsedReply["intent"]>,
    "expand" | "save" | "skip" | "share" | "unsubscribe"
  > = {
    ignore_topic: "skip",
    more_topic: "expand",
    read_original: "expand",
    change_schedule: "save",
    read_now: "expand",
    mute_source: "skip",
  };

  const matchedCluster = parsed.topic ? matchCluster(parsed.topic, clusters) : null;

  if (parsed.intent && parsed.confidence === "high") {
    await supabase.from("reply_actions").insert({
      user_id: userId,
      digest_id,
      cluster_id: matchedCluster?.id ?? null,
      action: DB_ACTION_MAP[parsed.intent],
      raw_reply: JSON.stringify({
        intent: parsed.intent,
        topic: parsed.topic,
        source: parsed.source,
        schedule: parsed.schedule,
      }),
      via: "inline",
      parsed_at: new Date().toISOString(),
    });
  }

  let extras: {
    sourceUrl?: string | null;
    clusterTopic?: string | null;
    scheduleSummary?: string | null;
    sourceName?: string | null;
    digestQueued?: boolean;
  } = {};

  switch (parsed.intent) {
    case "ignore_topic": {
      const topic = parsed.topic ?? matchedCluster?.topic;
      if (topic) {
        await supabase.from("topic_interests").upsert(
          { user_id: userId, topic: topic.toLowerCase(), weight: 0 },
          { onConflict: "user_id,topic" }
        );
      }
      extras = { clusterTopic: matchedCluster?.topic ?? parsed.topic };
      break;
    }

    case "more_topic": {
      const topic = parsed.topic ?? matchedCluster?.topic;
      if (topic) {
        await supabase.from("topic_interests").upsert(
          { user_id: userId, topic: topic.toLowerCase(), weight: 2.0 },
          { onConflict: "user_id,topic" }
        );
      }
      // Can't queue via Inngest in this fallback — the confirmation text will reflect that
      extras = { clusterTopic: matchedCluster?.topic ?? parsed.topic, digestQueued: false };
      break;
    }

    case "read_original": {
      extras = { sourceUrl: matchedCluster?.sourceUrl ?? null };
      break;
    }

    case "change_schedule": {
      if (parsed.schedule) {
        const updates = parseScheduleString(parsed.schedule);
        if (Object.keys(updates).length > 0) {
          await supabase
            .from("user_preferences")
            .update(updates)
            .eq("user_id", userId);
        }
        const parts: string[] = [];
        if (updates.digest_frequency) parts.push(`frequency: ${updates.digest_frequency}`);
        if (updates.digest_day != null) parts.push(`day: ${DAY_NAMES[updates.digest_day]}`);
        if (updates.digest_time) parts.push(`time: ${updates.digest_time}`);
        extras = { scheduleSummary: parts.length ? `your Brief is now set to arrive ${parts.join(", ")}` : null };
      }
      break;
    }

    case "read_now": {
      // Can't queue via Inngest in this fallback
      extras = { digestQueued: false };
      break;
    }

    case "mute_source": {
      if (parsed.source) {
        const { data: sourceRow } = await supabase
          .from("sources")
          .select("id, name")
          .eq("user_id", userId)
          .ilike("name", `%${parsed.source}%`)
          .limit(1)
          .maybeSingle();

        if (sourceRow) {
          await supabase
            .from("sources")
            .update({ status: "paused" })
            .eq("id", sourceRow.id);
          extras = { sourceName: sourceRow.name };
        } else {
          extras = { sourceName: parsed.source };
        }
      }
      break;
    }

    default:
      break;
  }

  // ── 4. Send confirmation / clarification reply ──────────────────────────────
  const { subject, text } = confirmationText(parsed, extras);

  await sendEmail({
    to: from_address,
    subject: digest.subject ? `Re: ${digest.subject}` : subject,
    htmlBody: text
      .split("\n")
      .map((line) => (line.trim() ? `<p>${line}</p>` : ""))
      .join(""),
    textBody: text,
  });

  console.log("[process-reply] done", { digest_id, intent: parsed.intent, confidence: parsed.confidence });
}
