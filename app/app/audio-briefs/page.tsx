/**
 * Audio Briefs page — premium only.
 * Shows all recent digests: ones with audio get an inline Play button,
 * ones without get a Generate button.
 * Free users see a paywall.
 */
import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/get-user";
import { createServiceClient } from "@/lib/supabase/service";
import { isAudioPremium, AUDIO_MONTHLY_CAP, getMonthlyAudioCount } from "@/lib/audio/premium";
import { Headphones, Lock } from "lucide-react";
import { UpgradeButton } from "@/components/billing/UpgradeButton";
import { AudioBriefsList } from "@/components/audio/AudioBriefsList";
import type { DigestItem, AudioRow } from "@/components/audio/AudioBriefsList";

export const metadata: Metadata = { title: "Audio Briefs" };

export default async function AudioBriefsPage() {
  const user = await getUser();
  if (!user) return null;

  const premium = await isAudioPremium(user.id);

  if (!premium) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-muted">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold">Audio Briefs</h1>
        <p className="text-muted-foreground">
          Listen to an audio version of every digest — narrated and ready in seconds.
          Available on the Pro plan.
        </p>
        <UpgradeButton plan="pro" className="mt-4">
          Upgrade to Pro
        </UpgradeButton>
      </div>
    );
  }

  const serviceSupabase = createServiceClient();

  const [{ data: recentDigests }, { data: audioRows }, monthlyCount] = await Promise.all([
    serviceSupabase
      .from("digests")
      .select("id, subject, period_end, status")
      .eq("user_id", user.id)
      .in("status", ["sent", "ready"])
      .order("period_end", { ascending: false })
      .limit(20),
    serviceSupabase
      .from("audio_digests")
      .select("id, digest_id, status, duration_sec, file_size_bytes, created_at, error_message")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getMonthlyAudioCount(user.id),
  ]);

  // Build a map: digest_id → audio row
  const audioByDigestId = new Map(
    (audioRows ?? []).map((r) => [r.digest_id, r])
  );

  const digests: DigestItem[] = (recentDigests ?? []).map((d) => {
    const a = audioByDigestId.get(d.id);
    return {
      id: d.id,
      subject: d.subject ?? null,
      period_end: d.period_end ?? null,
      audio: a
        ? ({
            id: a.id,
            digest_id: a.digest_id,
            status: a.status as AudioRow["status"],
            duration_sec: (a.duration_sec as number | null) ?? null,
            file_size_bytes: (a.file_size_bytes as number | null) ?? null,
            created_at: a.created_at,
          } satisfies AudioRow)
        : null,
    };
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="w-5 h-5" />
          <h1 className="text-xl font-semibold">Audio Briefs</h1>
        </div>
        <span className="text-xs text-muted-foreground">
          {monthlyCount} / {AUDIO_MONTHLY_CAP} this month
        </span>
      </div>

      <AudioBriefsList digests={digests} />
    </div>
  );
}
