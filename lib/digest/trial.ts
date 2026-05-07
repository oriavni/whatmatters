/**
 * Shared trial-limit helper.
 *
 * Enforces consistent trial limits across all digest generation paths:
 *   - POST /api/brief/generate  (web button)
 *   - digest-schedule           (cron)
 *   - email-reply               (email commands "read now", "more topic")
 *
 * Premium check (mirrors isUserPremium in lib/audio/premium.ts):
 *   - is_premium_override = true  → always allowed
 *   - status = 'active'           → always allowed
 *   - status = 'trialing'         → allowed while trial_end > now()
 *
 * Trial limits for non-premium users (no subscription or trial expired):
 *   - Account must be ≤ trial_days old (from pricing_config; falls back to TRIAL_DAYS)
 *   - No more than TRIAL_DIGEST_CAP non-failed digests total
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPricingConfig } from "@/lib/pricing";

/**
 * Safe fallback for trial window length when pricing_config DB is unavailable.
 * The live value comes from pricing_config.trial_days — this constant is only
 * used if getPricingConfig() throws unexpectedly.
 */
export const TRIAL_DAYS = 7;
export const TRIAL_DIGEST_CAP = 3;

export type TrialDenialReason = "trial_expired" | "trial_cap_reached";

export async function checkTrialAllowed(
  userId: string,
  service: SupabaseClient
): Promise<{ allowed: boolean; reason?: TrialDenialReason }> {
  const [{ data: userRow }, { data: subRow }, pricing] = await Promise.all([
    service.from("users").select("is_premium_override, created_at").eq("id", userId).maybeSingle(),
    service
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", userId)
      .maybeSingle(),
    getPricingConfig().catch(() => null),
  ]);

  // ── Premium / active subscription ────────────────────────────────────────
  const isPremiumOverride =
    (userRow as { is_premium_override?: boolean } | null)?.is_premium_override === true;
  const subStatus = (subRow as { status?: string; trial_end?: string | null } | null)?.status;
  const trialEnd  = (subRow as { status?: string; trial_end?: string | null } | null)?.trial_end;

  if (isPremiumOverride || subStatus === "active") return { allowed: true };

  // ── Active trial ──────────────────────────────────────────────────────────
  // status='trialing' with trial_end in the future → still in trial, no cap
  if (subStatus === "trialing") {
    const trialEndDate = trialEnd ? new Date(trialEnd) : null;
    if (!trialEndDate || trialEndDate > new Date()) return { allowed: true };
    // trial_end has passed — fall through to legacy account-age check
  }

  // ── No subscription row — use account age as the trial window ─────────────
  // Guard: if userRow is null (signup trigger failed), do NOT fall back to epoch
  // (which would make accountAgeMs = ~56 years and immediately return expired).
  // Instead, log the anomaly and fail open with a soft trial window.
  const createdAt = (userRow as { created_at?: string } | null)?.created_at;
  if (!createdAt) {
    // Missing public.users row — broken signup. Log to console for debugging;
    // the admin repair migration will backfill these accounts.
    console.warn(`[checkTrialAllowed] no public.users row for userId=${userId} — treating as new trial`);
    return { allowed: true };
  }

  const trialDays = pricing?.trial_days ?? TRIAL_DAYS;
  const trialWindowMs = trialDays * 24 * 60 * 60 * 1000;
  const accountAgeMs = Date.now() - new Date(createdAt).getTime();

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
