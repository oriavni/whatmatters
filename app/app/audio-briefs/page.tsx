/**
 * Audio Briefs page — premium only.
 * Shows all recent digests: ones with audio get a Play button,
 * ones without get a Generate button.
 * Free users see a paywall.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isUserPremium, AUDIO_MONTHLY_CAP, getMonthlyAudioCount } from "@/lib/audio/premium";
import Link from "next/link";
import { Headphones, Lock } from "lucide-react";
import { GenerateAudioButton } from "@/components/audio/GenerateAudioButton";

export const metadata: Metadata = { title: "Audio Briefs" };

export default async function AudioBriefsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const premium = await isUserPremium(user.id);

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
        <Link
          href="/pricing"
          className="inline-block mt-4 px-6 py-2 rounded-md bg-foreground text-background text-sm font-medium"
        >
          Upgrade to Pro
        </Link>
      </div>
    );
  }

  const serviceSupabase = createServiceClient();

  // Load recent sent/ready digests + existing audio rows in parallel
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
      .select("id, digest_id, status, created_at, error_message")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getMonthlyAudioCount(user.id),
  ]);

  // Build a map: digest_id → audio row
  const audioByDigestId = new Map(
    (audioRows ?? []).map((r) => [r.digest_id, r])
  );

  const digests = recentDigests ?? [];

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

      {digests.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Headphones className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No briefs yet.</p>
          <p className="text-sm mt-1">Your digests will appear here once generated.</p>
        </div>
      ) : (
        <div className="divide-y">
          {digests.map((digest) => {
            const audio = audioByDigestId.get(digest.id);
            const date = new Date(digest.period_end ?? "").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            });

            return (
              <div key={digest.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{digest.subject ?? "Brief"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {!audio && (
                    <GenerateAudioButton digestId={digest.id} />
                  )}
                  {audio?.status === "completed" && (
                    <Link
                      href={`/app/audio-briefs/${digest.id}`}
                      className="text-sm px-3 py-1.5 rounded-md bg-foreground text-background font-medium"
                    >
                      ▶ Play
                    </Link>
                  )}
                  {(audio?.status === "pending" || audio?.status === "generating") && (
                    <span className="text-xs text-muted-foreground animate-pulse">Generating…</span>
                  )}
                  {audio?.status === "failed" && (
                    <GenerateAudioButton digestId={digest.id} label="Retry" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
