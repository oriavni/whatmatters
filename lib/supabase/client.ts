/**
 * Supabase browser client.
 * Use in Client Components ("use client") only.
 *
 * IMPORTANT: Do NOT import config.ts here.
 * NEXT_PUBLIC_* vars are inlined by the Next.js bundler only when accessed
 * as a literal dot-notation expression (process.env.NEXT_PUBLIC_FOO).
 * Any dynamic lookup — process.env[key] or a helper function — produces
 * undefined in the browser bundle because the bundler cannot statically
 * replace the value.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    // Literal accesses — bundler replaces these with the actual string at build time
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
