"use client";

/**
 * Interactive Audio Briefs list.
 *
 * - "Generate" fires generation inline — no page navigation, no alert().
 * - Completed rows expand with an animated inline mini-player on Play.
 * - Pending/generating rows poll until ready, then flip to Play.
 * - The global floating bar appears automatically when a track is loaded.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAudioPlayer } from "@/lib/audio/player-context";

export interface AudioRow {
  id: string;
  digest_id: string;
  status: "pending" | "generating" | "completed" | "failed";
  duration_sec: number | null;
  created_at: string;
}

export interface DigestItem {
  id: string;
  subject: string | null;
  period_end: string | null;
  audio: AudioRow | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtDuration(sec: number | null | undefined): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const POLL_MS = 3000;

// ── Inline mini-player ────────────────────────────────────────────────────────

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
    <div className="pt-3 pb-0.5 flex items-center gap-3">
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

// ── Single row ────────────────────────────────────────────────────────────────

function AudioBriefRow({ digest }: { digest: DigestItem }) {
  const player = useAudioPlayer();
  const [audio, setAudio] = useState<AudioRow | null>(digest.audio);
  const [expanded, setExpanded] = useState(false);
  const [loadingPlay, setLoadingPlay] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActiveTrack = player.track?.digestId === digest.id;
  const title = digest.subject ?? "Audio Brief";
  const date = new Date(digest.period_end ?? "").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Stop polling on unmount
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  // Start polling whenever status is pending/generating
  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // already polling
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/audio/${digest.id}`);
        const data = await res.json();
        if (data.status === "completed" || data.status === "failed") {
          setAudio((prev) => prev ? { ...prev, status: data.status } : prev);
          setGenerating(false);
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        } else if (data.status === "pending" || data.status === "generating") {
          setAudio((prev) => prev ? { ...prev, status: data.status } : prev);
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_MS);
  }, [digest.id]);

  // Pick up already-in-progress rows from server render
  useEffect(() => {
    if (audio?.status === "pending" || audio?.status === "generating") {
      setGenerating(true);
      startPolling();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate inline
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_id: digest.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerating(false);
        setGenError(data.error ?? "Failed to start generation.");
        return;
      }
      // Row is now pending — start polling
      setAudio((prev) =>
        prev
          ? { ...prev, status: "pending" }
          : { id: data.audio_digest_id ?? "", digest_id: digest.id, status: "pending", duration_sec: null, created_at: new Date().toISOString() }
      );
      startPolling();
    } catch {
      setGenerating(false);
      setGenError("Something went wrong. Please try again.");
    }
  }, [digest.id, startPolling]);

  // Play inline — fetch signed URL on demand, load into global player
  const handlePlay = useCallback(async () => {
    if (isActiveTrack) {
      // Toggle expand / play-pause
      if (!expanded) {
        setExpanded(true);
      } else {
        player.togglePlayPause();
      }
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
  }, [digest.id, expanded, isActiveTrack, player, title]);

  // ── Row actions ─────────────────────────────────────────────────────────────
  const showGenerate = !audio && !generating;
  const showGenerating = generating || audio?.status === "pending" || audio?.status === "generating";
  const showPlay = !generating && audio?.status === "completed";
  const showFailed = !generating && audio?.status === "failed";

  return (
    <div className="py-4">
      {/* ── Main row ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Duration badge — only shown for completed audio */}
          {showPlay && fmtDuration(audio?.duration_sec) && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {fmtDuration(audio?.duration_sec)}
            </span>
          )}

          {showGenerate && (
            <Button variant="outline" size="sm" onClick={handleGenerate}>
              <Headphones className="w-3 h-3 mr-1.5" />
              Generate
            </Button>
          )}

          {showGenerating && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating…
            </span>
          )}

          {showPlay && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlay}
              disabled={loadingPlay}
            >
              {loadingPlay ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isActiveTrack && player.isPlaying && expanded ? (
                <><Pause className="w-3 h-3 mr-1" />Pause</>
              ) : (
                <><Play className="w-3 h-3 mr-1" />Play</>
              )}
            </Button>
          )}

          {showFailed && (
            <Button variant="outline" size="sm" onClick={handleGenerate}>
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* ── Inline error ── */}
      {genError && (
        <p className="mt-2 text-xs text-destructive">{genError}</p>
      )}

      {/* ── Animated inline mini-player ── */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          expanded && showPlay ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <InlineMiniPlayer digestId={digest.id} title={title} />
        </div>
      </div>
    </div>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

export function AudioBriefsList({ digests }: { digests: DigestItem[] }) {
  if (digests.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Headphones className="w-10 h-10 mx-auto mb-3 opacity-30" />
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
