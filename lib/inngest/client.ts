/**
 * Inngest client — shared across all Inngest functions.
 * TODO (Prompt 5+): Wire real event key from config once Inngest is fully set up.
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "whatmatters",
  // eventKey is set via INNGEST_EVENT_KEY env var automatically by the SDK
});
