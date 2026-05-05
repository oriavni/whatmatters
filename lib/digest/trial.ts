/**
 * Shared trial-limit helper.
 *
 * Enforces consistent trial limits across all digest generation paths:
 *   - POST /api/brief/generate  (web button)
 *   - digest-schedule           (cron)
 *   - email-reply               (email commands "read now", "more topic")
 *
 * Trial limits for non-premium users:
 *   - Account must be ≤ 3 days old
 *   - No more than 3 non-failed digests total
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const TRIAL_DAYS = 3;
export const TRIAL_DIGEST_CAP = 3;

export type TrialDenialReason = "trial_expired" | "trial_cap_reached";

export async function checkTrialAllowed(
  userId: string,
  service: SupabaseClient
): Promise<{ allowed: boolean; reason?: TrialDenialReason }> {
  const [{ data: userRow }, { data: subRow }] = await Promise.all([
    service.from("users").select("is_premium_override, created_at").eq("id", userId).single(),
    service.from("subscriptions").select("status").eq("user_id", userId).maybeSingle(),
  ]);

  const isActivePremium =
    (userRow as { is_premium_override?: boolean } | null)?.is_premium_override === true ||
    subRow?.status === "active";

  if (isActivePremium) return { allowed: true };

  const trialWindowMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const accountAgeMs =
    Date.now() -
    new Date((userRow as { created_at?: string } | null)?.created_at ?? 0).getTime();

  if (accountAgeMs > trialWindowMs) {
    return { allowed: false, reason: "trial_expired" };
  }

  const { count: digestCount } = await service
    .from("digests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("status", "eq", "failed");

  if ((digestCount ?? 0) >= TRIAL_DIGEST_CAP) {
    return { allowed: false, reason: "trial_cap_reached" };
  }

  return { allowed: true };
}
