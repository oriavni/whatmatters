/**
 * Audio Briefs page — premium only.
 * Lists all generated audio briefs for the current user.
 * Free users see a paywall.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isUserPremium, AUDIO_MONTHLY_CAP, getMonthlyAudioCount } from "@/lib/audio/premium";
import Link from "next/link";
import { Headphones, Lock } from "lucide-react";

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
  const [{ data: audioRows }, monthlyCount] = await Promise.all([
    serviceSupabase
      .from("audio_digests")
      .select("id, digest_id, status, duration_sec, file_size_bytes, created_at, error_message")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    getMonthlyAudioCount(user.id),
  ]);

  // Load digest subjects for display
  const digestIds = (audioRows ?? []).map((r) => r.digest_id);
  const { data: digests } = digestIds.length > 0
    ? await serviceSupabase.from("digests").select("id, subject, period_end").in("id", digestIds)
    : { data: [] };

  const digestById = new Map((digests ?? []).map((d) => [d.id, d]));

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

      {(audioRows ?? []).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Headphones className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No audio briefs yet.</p>
          <p className="text-sm mt-1">
            Open a brief and tap <strong>Listen</strong> to generate your first one.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {(audioRows ?? []).map((row) => {
            const digest = digestById.get(row.digest_id);
            const date = new Date(row.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });

            return (
              <div key={row.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">
                    {digest?.subject ?? "Brief"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {row.status === "completed" && (
                    <Link
                      href={`/app/audio-briefs/${row.digest_id}`}
                      className="text-sm px-3 py-1 rounded-md bg-foreground text-background font-medium"
                    >
                      ▶ Play
                    </Link>
                  )}
                  {(row.status === "pending" || row.status === "generating") && (
                    <span className="text-xs text-muted-foreground animate-pulse">Generating…</span>
                  )}
                  {row.status === "failed" && (
                    <span className="text-xs text-destructive">Failed</span>
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
