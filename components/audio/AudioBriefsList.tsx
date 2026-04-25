"use client";

/**
 * Interactive Audio Briefs list.
 *
 * - Completed rows expand inline on Play click — no page navigation needed.
 * - Inline mini-player shows progress/scrubber synced with the global player.
 * - Pending/generating rows poll until ready, then flip to Play.
 * - Global floating bar appears automatically when a track is loaded.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GenerateAudioButton } from "@/components/audio/GenerateAudioButton";
import { useAudioPlayer } from "@/lib/audio/player-context";

export interface AudioRow {
  id: string;
  digest_id: string;
  status: "pending" | "generating" | "completed" | "failed";
  created_at: string;
}

export interface DigestItem {
  id: string;
  subject: string | null;
  period_end: string | null;
  audio: AudioRow | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const POLL_MS = 3000;

// ── Inline mini-player (shown when a row is expanded) ────────────────────────

function InlineMiniPlayer({ digestId, title }: { digestId: string; title: string }) {
  const { track, isPlaying, currentTime, duration, togglePlayPause, seek } = useAudioPlayer();
  const isActive = track?.digestId === digestId;
  const progress = isActive && duration > 0 ? (currentTime / duration) * 100 : 0;

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isActive || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seek(Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration)));
  }

  return (
    <div className="pt-3 pb-1 flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={togglePlayPause}
        aria-label={isPlaying && isActive ? "Pause" : "Play"}
      >
        {isPlaying && isActive ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5" />
        )}
      </Button>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground tabular-nums w-7 shrink-0">
          {isActive ? fmt(currentTime) : "0:00"}
        </span>
        <div
          className="flex-1 cursor-pointer py-1"
          onClick={handleBarClick}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={isActive ? Math.round(currentTime) : 0}
          aria-label={`Seek ${title}`}
        >
          <Progress value={progress} className="h-1" />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums w-7 shrink-0 text-right">
          {isActive ? fmt(duration) : "--:--"}
        </span>
      </div>
    </div>
  );
}

// ── Single list row ───────────────────────────────────────────────────────────

function AudioBriefRow({ digest }: { digest: DigestItem }) {
  const player = useAudioPlayer();
  const [audio, setAudio] = useState<AudioRow | null>(digest.audio);
  const [expanded, setExpanded] = useState(false);
  const [loadingPlay, setLoadingPlay] = useState(false);

  const isActiveTrack = player.track?.digestId === digest.id;
  const title = digest.subject ?? "Audio Brief";
  const date = new Date(digest.period_end ?? "").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Poll while generating/pending — flip to completed when done.
  useEffect(() => {
    if (audio?.status !== "pending" && audio?.status !== "generating") return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/audio/${digest.id}`);
        const data = await res.json();
        if (data.status === "completed" || data.status === "failed") {
          setAudio((prev) =>
            prev ? { ...prev, status: data.status } : prev
          );
          clearInterval(iv);
        } else {
          setAudio((prev) =>
            prev ? { ...prev, status: data.status } : prev
          );
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_MS);
    return () => clearInterval(iv);
  }, [audio?.status, digest.id]);

  // After GenerateAudioButton fires, audio row may not exist yet — listen for it.
  useEffect(() => {
    if (audio) return; // already have a row
    // Only start polling once we know generation was initiated
    // (GenerateAudioButton navigates back here, so the server re-renders the page
    // with the new row; but in case it's still propagating we do one quick check).
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/audio/${digest.id}`);
        const data = await res.json();
        if (data.status && data.status !== "not_found") {
          setAudio({
            id: "",
            digest_id: digest.id,
            status: data.status,
            created_at: new Date().toISOString(),
          });
        }
      } catch {
        // ignore
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [audio, digest.id]);

  const handlePlay = useCallback(async () => {
    // If this track is already loaded, just toggle expand + play/pause.
    if (isActiveTrack) {
      setExpanded((e) => !e);
      player.togglePlayPause();
      return;
    }

    setLoadingPlay(true);
    try {
      const res = await fetch(`/api/audio/${digest.id}`);
      const data = await res.json();
      if (data.status === "completed" && data.audio_url) {
        player.load({ digestId: digest.id, title, audioUrl: data.audio_url });
        setExpanded(true);
      }
    } finally {
      setLoadingPlay(false);
    }
  }, [digest.id, isActiveTrack, player, title]);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* No audio row yet */}
          {!audio && (
            <GenerateAudioButton digestId={digest.id} />
          )}

          {/* Completed → inline Play button */}
          {audio?.status === "completed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlay}
              disabled={loadingPlay}
            >
              {loadingPlay ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isActiveTrack && player.isPlaying ? (
                <><Pause className="w-3 h-3 mr-1" /> Pause</>
              ) : (
                <><Play className="w-3 h-3 mr-1" /> Play</>
              )}
            </Button>
          )}

          {/* Generating */}
          {(audio?.status === "pending" || audio?.status === "generating") && (
            <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating…
            </span>
          )}

          {/* Failed → retry */}
          {audio?.status === "failed" && (
            <GenerateAudioButton digestId={digest.id} label="Retry" />
          )}
        </div>
      </div>

      {/* Inline mini-player — shown when this row is expanded */}
      {expanded && audio?.status === "completed" && (
        <InlineMiniPlayer digestId={digest.id} title={title} />
      )}
    </div>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

export function AudioBriefsList({ digests }: { digests: DigestItem[] }) {
  if (digests.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No briefs yet.</p>
        <p className="text-sm mt-1">Your digests will appear here once generated.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {digests.map((digest) => (
        <AudioBriefRow key={digest.id} digest={digest} />
      ))}
    </div>
  );
}
