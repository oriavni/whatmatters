/**
 * lib/config.ts — central environment variable registry.
 *
 * ALL values are read lazily (getter functions), so importing this module
 * at the top of a file does NOT throw at build time — only at the moment
 * a value is actually read at runtime.
 *
 * ─── NEXT_PUBLIC_* RULE ───────────────────────────────────────────────────
 * The Next.js bundler inlines NEXT_PUBLIC_* values into the client bundle
 * ONLY when they appear as a literal dot-notation access:
 *
 *   ✅  process.env.NEXT_PUBLIC_SUPABASE_URL          ← bundler inlines this
 *   ❌  process.env["NEXT_PUBLIC_SUPABASE_URL"]        ← NOT inlined
 *   ❌  const key = "NEXT_PUBLIC_SUPABASE_URL"         ← NOT inlined
 *       process.env[key]
 *
 * Therefore every NEXT_PUBLIC_* getter below must use a literal property
 * access, NOT the shared required()/optional() helpers.
 *
 * ─── SERVER-ONLY RULE ────────────────────────────────────────────────────
 * Non-public secrets (STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, etc.)
 * must NEVER be imported in files that end up in the browser bundle.
 * Use them only in: Server Components, Route Handlers, Server Actions,
 * lib/supabase/server.ts, lib/supabase/middleware.ts.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Server-only: throws clearly when a required secret is missing. */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[config] Missing required environment variable: ${key}\n` +
        `Check your .env.local file against .env.local.example`
    );
  }
  return value;
}

/** Server-only: returns the value or a fallback. */
function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // ─── App ──────────────────────────────────────────────────────────────
  // NEXT_PUBLIC — safe on client, must use literal access
  app: {
    get url(): string {
      // Literal access — bundler can inline this in browser bundles
      return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    },
    get env(): "development" | "production" | "test" {
      return (process.env.NODE_ENV ?? "development") as
        | "development"
        | "production"
        | "test";
    },
    get isDev(): boolean {
      return (process.env.NODE_ENV ?? "development") === "development";
    },
    get isProd(): boolean {
      return process.env.NODE_ENV === "production";
    },
  },

  // ─── Supabase ─────────────────────────────────────────────────────────
  supabase: {
    // PUBLIC — literal access required for client-bundle inlining
    get url(): string {
      const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!v) throw new Error("[config] Missing NEXT_PUBLIC_SUPABASE_URL");
      return v;
    },
    get anonKey(): string {
      const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!v) throw new Error("[config] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return v;
    },
    // SERVER-ONLY — dynamic lookup is fine here; never imported client-side
    get serviceRoleKey(): string {
      return required("SUPABASE_SERVICE_ROLE_KEY");
    },
  },

  // ─── Stripe ───────────────────────────────────────────────────────────
  stripe: {
    // SERVER-ONLY
    get secretKey(): string {
      return required("STRIPE_SECRET_KEY");
    },
    // PUBLIC — literal access required
    get publishableKey(): string {
      const v = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!v) throw new Error("[config] Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
      return v;
    },
    // SERVER-ONLY
    get webhookSecret(): string {
      return required("STRIPE_WEBHOOK_SECRET");
    },
    prices: {
      get proMonthly(): string {
        return optional("STRIPE_PRICE_PRO_MONTHLY", "");
      },
      get proAnnual(): string {
        return optional("STRIPE_PRICE_PRO_ANNUAL", "");
      },
    },
  },

  // ─── Postmark (server-only) ────────────────────────────────────────────
  postmark: {
    get serverToken(): string {
      return required("POSTMARK_SERVER_TOKEN");
    },
    get webhookSecret(): string {
      return required("POSTMARK_WEBHOOK_SECRET");
    },
    get fromAddress(): string {
      return optional("POSTMARK_FROM_ADDRESS", "brief@yourdomain.com");
    },
    get inboundDomain(): string {
      return optional("POSTMARK_INBOUND_DOMAIN", "inbound.yourdomain.com");
    },
    get replyDomain(): string {
      return optional("POSTMARK_REPLY_DOMAIN", "reply.yourdomain.com");
    },
  },

  // ─── Inngest (server-only) ────────────────────────────────────────────
  inngest: {
    get eventKey(): string {
      return required("INNGEST_EVENT_KEY");
    },
    get signingKey(): string {
      return required("INNGEST_SIGNING_KEY");
    },
  },

  // ─── LLM / AI (server-only) ───────────────────────────────────────────
  llm: {
    get openaiApiKey(): string {
      return required("OPENAI_API_KEY");
    },
    get model(): string {
      return optional("LLM_MODEL", "gpt-4o");
    },
    get clusteringModel(): string {
      return optional("LLM_CLUSTERING_MODEL", "gpt-4o");
    },
    get synthesisModel(): string {
      return optional("LLM_SYNTHESIS_MODEL", "gpt-4o");
    },
    get replyParsingModel(): string {
      return optional("LLM_REPLY_PARSING_MODEL", "gpt-4o-mini");
    },
  },

  // ─── Admin (server-only) ──────────────────────────────────────────────
  admin: {
    get secret(): string {
      return required("ADMIN_SECRET");
    },
  },
} as const;

export type Config = typeof config;
