/**
 * Premium gating for Audio Briefs.
 *
 * A user is considered premium if:
 *   - They have an active subscription (status = 'active'), OR
 *   - Admin has manually set is_premium_override = true on their user row.
 *
 * Monthly cap: 20 audio generations per rolling 30-day window.
 */
import { createServiceClient } from "@/lib/supabase/service";

export const AUDIO_MONTHLY_CAP = 20;

export async function isUserPremium(userId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const [{ data: userRow }, { data: subRow }] = await Promise.all([
    supabase
      .from("users")
      .select("is_premium_override")
      .eq("id", userId)
      .single(),
    supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  return (userRow?.is_premium_override === true) || (subRow !== null);
}

export async function getMonthlyAudioCount(userId: string): Promise<number> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("audio_digests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "failed")
    .gte("created_at", since);

  return count ?? 0;
}

export async function canGenerateAudio(userId: string): Promise<{
  allowed: boolean;
  reason?: "not_premium" | "cap_reached";
}> {
  const premium = await isUserPremium(userId);
  if (!premium) return { allowed: false, reason: "not_premium" };

  const count = await getMonthlyAudioCount(userId);
  if (count >= AUDIO_MONTHLY_CAP) return { allowed: false, reason: "cap_reached" };

  return { allowed: true };
}
