import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { emailInbound } from "@/lib/inngest/functions/email-inbound";
import { emailReplyParse } from "@/lib/inngest/functions/email-reply";
import { digestGenerate } from "@/lib/inngest/functions/digest-generate";
import { digestSend } from "@/lib/inngest/functions/digest-send";
import { rssFetchAll } from "@/lib/inngest/functions/rss-fetch";
import { rssFetchOne } from "@/lib/inngest/functions/rss-fetch-one";
import { feedbackProcess } from "@/lib/inngest/functions/feedback-process";

// Required: prevents Next.js/Turbopack from statically analysing this route
// at build/compile time with a frozen process.env snapshot. Without this,
// server-only env vars (OPENAI_API_KEY, etc.) may be undefined when Inngest
// step callbacks execute in a fresh module evaluation cycle.
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    emailInbound,
    emailReplyParse,
    digestGenerate,
    digestSend,
    rssFetchAll,
    rssFetchOne,
    feedbackProcess,
  ],
});
