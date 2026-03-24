import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { emailInbound } from "@/lib/inngest/functions/email-inbound";
import { emailReplyParse } from "@/lib/inngest/functions/email-reply";
import { digestGenerate } from "@/lib/inngest/functions/digest-generate";
import { digestSend } from "@/lib/inngest/functions/digest-send";
import { rssFetchAll } from "@/lib/inngest/functions/rss-fetch";
import { feedbackProcess } from "@/lib/inngest/functions/feedback-process";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    emailInbound,
    emailReplyParse,
    digestGenerate,
    digestSend,
    rssFetchAll,
    feedbackProcess,
  ],
});
