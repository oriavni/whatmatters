/**
 * Parse and execute a reply-to-email command.
 * Triggered by: email/reply.parse event (fired by the Postmark webhook).
 *
 * Steps:
 *   1. load-context  — load digest, user email, and clusters for entity matching
 *   2. parse-intent  — LLM classifies the reply into one of 6 V1 intents
 *   3. execute-action — persist the action and mutate state accordingly
 *   4. send-reply    — send a plain confirmation (or clarification) email back
 *
 * V1 intents: ignore_topic, more_topic, read_original,
 *             change_schedule, read_now, mute_source
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { generate } from "@/lib/llm/client";
import { buildReplyParsingPrompt, type ParsedReply } from "@/lib/llm/prompts/parse-reply";
import { sendEmail } from "@/lib/email/postmark";
import { config } from "@/lib/config";

interface ReplyEvent {
  digest_id: string;
  from_address: string;
  raw_text: string;
  message_id: string;
}

// ── Schedule parsing ──────────────────────────────────────────────────────────

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

  // Frequency
  if (lower.includes("daily") || lower.includes("every day")) {
    result.digest_frequency = "daily";
    result.digest_day = null;
  } else if (lower.includes("weekly") || lower.includes("once a week")) {
    result.digest_frequency = "weekly";
  }

  // Day of week
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (lower.includes(DAY_NAMES[i])) {
      result.digest_frequency = "weekly";
      result.digest_day = i;
      break;
    }
  }

  // Time (e.g. "8am", "9:30", "14:00")
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

// ── Cluster topic matching ────────────────────────────────────────────────────

/**
 * Find the cluster whose topic best matches the user's topic string.
 * Simple case-insensitive substring check — no embeddings needed for V1.
 */
function matchCluster(
  topic: string,
  clusters: { id: string; topic: string; sourceUrl: string | null }[]
): { id: string; topic: string; sourceUrl: string | null } | null {
  const lower = topic.toLowerCase();
  // Use word-boundary matching to prevent "ai" matching "Ukraine", etc.
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

// ── Confirmation email text ───────────────────────────────────────────────────

function confirmationText(
  parsed: ParsedReply,
  extras: {
    sourceUrl?: string | null;
    clusterTopic?: string | null;
    scheduleSummary?: string | null;
    sourceName?: string | null;
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
        subject: "Brief: generating more",
        text: `On it — I've queued a fresh digest. You'll receive it shortly.`,
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
        subject: "Brief: generating now",
        text: `Your fresh Brief is being generated. Check your inbox in a few minutes.`,
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

// ── Inngest function ──────────────────────────────────────────────────────────

export const emailReplyParse = inngest.createFunction(
  {
    id: "email-reply-parse",
    name: "Parse Email Reply Command",
    triggers: [{ event: "email/reply.parse" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { digest_id, from_address, raw_text } = event.data as ReplyEvent;

    // ── Step 1: Load context ────────────────────────────────────────────────
    const { userId, userEmail, digestSubject, clusters } = await step.run(
      "load-context",
      async () => {
        const supabase = createServiceClient();

        const { data: digest, error: digestError } = await supabase
          .from("digests")
          .select("user_id, subject")
          .eq("id", digest_id)
          .single();

        if (digestError || !digest) {
          throw new Error(`load-context: digest not found — ${digestError?.message}`);
        }

        const { data: userRow, error: userError } = await supabase
          .from("users")
          .select("email")
          .eq("id", digest.user_id)
          .single();

        if (userError || !userRow) {
          throw new Error(`load-context: user not found — ${userError?.message}`);
        }

        // Load clusters with item source URLs for read_original + mute_source matching
        const { data: clusterRows } = await supabase
          .from("topic_clusters")
          .select("id, topic, raw_item_ids")
          .eq("digest_id", digest_id)
          .order("rank", { ascending: true });

        // Resolve first source URL per cluster (for read_original)
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

        return {
          userId: digest.user_id,
          userEmail: userRow.email,
          digestSubject: digest.subject,
          clusters,
        };
      }
    );

    // ── Step 2: Parse intent via LLM ───────────────────────────────────────
    const parsed = await step.run("parse-intent", async () => {
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

      try {
        return JSON.parse(response.content) as ParsedReply;
      } catch {
        // Malformed JSON from LLM — treat as ambiguous
        return {
          intent: null,
          topic: null,
          source: null,
          schedule: null,
          confidence: "low" as const,
        };
      }
    });

    // ── Step 3: Execute action ─────────────────────────────────────────────
    const extras = await step.run("execute-action", async () => {
      const supabase = createServiceClient();

      // Always record the raw reply action (best-effort)
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

      const matchedCluster = parsed.topic
        ? matchCluster(parsed.topic, clusters)
        : null;

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
          via: "inngest",
          parsed_at: new Date().toISOString(),
        });
      }

      // Execute the intent-specific side effect
      switch (parsed.intent) {
        case "ignore_topic": {
          const topic = parsed.topic ?? matchedCluster?.topic;
          if (topic) {
            await supabase.from("topic_interests").upsert(
              { user_id: userId, topic: topic.toLowerCase(), weight: 0 },
              { onConflict: "user_id,topic" }
            );
          }
          return { clusterTopic: matchedCluster?.topic ?? parsed.topic };
        }

        case "more_topic": {
          // Boost interest weight for the topic, then queue a fresh digest
          const topic = parsed.topic ?? matchedCluster?.topic;
          if (topic) {
            await supabase.from("topic_interests").upsert(
              { user_id: userId, topic: topic.toLowerCase(), weight: 2.0 },
              { onConflict: "user_id,topic" }
            );
          }
          await inngest.send({
            name: "digest/generate",
            data: { user_id: userId },
          });
          return { clusterTopic: matchedCluster?.topic ?? parsed.topic };
        }

        case "read_original": {
          return { sourceUrl: matchedCluster?.sourceUrl ?? null };
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
            // Build a human-readable summary of what changed
            const parts: string[] = [];
            if (updates.digest_frequency) parts.push(`frequency: ${updates.digest_frequency}`);
            if (updates.digest_day != null) {
              parts.push(`day: ${DAY_NAMES[updates.digest_day]}`);
            }
            if (updates.digest_time) parts.push(`time: ${updates.digest_time}`);
            return { scheduleSummary: parts.length ? `your Brief is now set to arrive ${parts.join(", ")}` : null };
          }
          return {};
        }

        case "read_now": {
          await inngest.send({
            name: "digest/generate",
            data: { user_id: userId },
          });
          return {};
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
              return { sourceName: sourceRow.name };
            }
          }
          return { sourceName: parsed.source };
        }

        default:
          // null intent — nothing to persist
          return {};
      }
    });

    // ── Step 4: Send confirmation / clarification reply ────────────────────
    await step.run("send-reply", async () => {
      const { subject, text } = confirmationText(parsed, extras as Parameters<typeof confirmationText>[1]);
      const replyTo = from_address; // reply back to whoever sent the email

      await sendEmail({
        to: replyTo,
        subject: digestSubject ? `Re: ${digestSubject}` : subject,
        htmlBody: text
          .split("\n")
          .map((line) => (line.trim() ? `<p>${line}</p>` : ""))
          .join(""),
        textBody: text,
      });
    });

    return {
      intent: parsed.intent,
      confidence: parsed.confidence,
      digest_id,
      user_id: userId,
      from_address,
    };
  }
);
