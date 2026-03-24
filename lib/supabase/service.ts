/**
 * Supabase service-role client.
 * Use ONLY in server-side contexts that run without a user session:
 *   - Webhook handlers (Postmark, Stripe)
 *   - Inngest background functions
 *   - Admin routes
 *
 * Never import this in Client Components or expose it to the browser.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { config } from "@/lib/config";

export function createServiceClient() {
  return createClient<Database>(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
