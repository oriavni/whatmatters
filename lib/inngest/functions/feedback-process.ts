/**
 * Process a batch of feedback events and update topic interest scores.
 * Triggered by: feedback/process event.
 * TODO (Prompt 7+): Implement.
 */
import { inngest } from "@/lib/inngest/client";

export const feedbackProcess = inngest.createFunction(
  {
    id: "feedback-process",
    name: "Process Feedback Events",
    triggers: [{ event: "feedback/process" }],
  },
  async ({ event, step: _step }) => {
    const { user_id } = event.data as { user_id: string };
    console.log("feedback-process stub — user_id:", user_id);
  }
);
