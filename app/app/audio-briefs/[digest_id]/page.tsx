/**
 * Audio Brief player page.
 * Accessed via email "Listen to this Brief" button or from Audio Briefs list.
 */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isUserPremium } from "@/lib/audio/premium";
import { getAudioSignedUrl } from "@/lib/audio/generate";
import { AudioBriefPlayer } from "@/components/audio/AudioBriefPlayer";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Listen — Audio Brief" };

export default async function AudioBriefDetailPage({
  params,
}: {
  params: Promise<{ digest_id: string }>;
}) {
  const { digest_id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const premium = await isUserPremium(user.id);
  if (!premium) redirect("/app/audio-briefs");

  const serviceSupabase = createServiceClient();

  const [{ data: audioRow }, { data: digest }] = await Promise.all([
    serviceSupabase
      .from("audio_digests")
      .select("id, status, storage_path, duration_sec, file_size_bytes, error_message, created_at")
      .eq("user_id", user.id)
      .eq("digest_id", digest_id)
      .maybeSingle(),
    serviceSupabase
      .from("digests")
      .select("id, subject, period_end, user_id")
      .eq("id", digest_id)
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!digest) redirect("/app/audio-briefs");

  let audioUrl: string | null = null;
  if (audioRow?.status === "completed" && audioRow.storage_path) {
    audioUrl = await getAudioSignedUrl(audioRow.storage_path);
  }

  return (
    <div className="max-w-xl mx-auto mt-10 space-y-6">
      <div>
        <Link href="/app/audio-briefs" className="text-xs text-muted-foreground hover:underline">
          &larr; Audio Briefs
        </Link>
        <h1 className="text-xl font-semibold mt-2">{digest.subject ?? "Brief"}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(digest.period_end ?? "").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
          })}
        </p>
      </div>

      <AudioBriefPlayer
        digestId={digest_id}
        title={digest.subject ?? "Audio Brief"}
        audioUrl={audioUrl}
        status={audioRow?.status ?? "not_found"}
      />

      <div className="pt-4 border-t">
        <Link
          href={`/app/brief/${digest_id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          Read the full brief &rarr;
        </Link>
      </div>
    </div>
  );
}
