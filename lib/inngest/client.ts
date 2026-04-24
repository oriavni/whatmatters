/**
 * Inngest client — shared across all Inngest functions.
 * isDev is explicitly tied to NODE_ENV so production deployments
 * always run in cloud mode and sign their introspection responses.
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "whatmatters",
  isDev: process.env.NODE_ENV !== "production",
});
