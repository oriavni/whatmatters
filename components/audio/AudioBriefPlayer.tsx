"use client";

/**
 * Full-page Audio Brief player.
 * Used on /app/audio-briefs/[digest_id].
 *
 * Delegates actual playback to the global AudioPlayerContext so the
 * floating bottom bar appears and playback survives navigation.
 */

import { useEffect, useState } from "react";
import { Headphones, Loader2, AlertCircle, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAudioPlayer } from "@/lib/audio/player-context";

interface AudioBriefPlayerProps {
  digestId: string;
  title: string;
  audioUrl: string | null;
  status: string;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioBriefPlayer({
  digestId,
  title,
  audioUrl: initialAudioUrl,
  status: initialStatus,
}: AudioBriefPlayerProps) {
  const player = useAudioPlayer();
  const [status, setStatus] = useState(initialStatus);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [isStarting, setIsStarting] = useState(false);

  const isActive = player.track?.digestId === digestId;
  const progress =
    isActive && player.duration > 0
      ? (player.currentTime / player.duration) * 100
      : 0;

  // Auto-load into global player once URL is available
  useEffect(() => {
    if (status === "completed" && audioUrl) {
      // Load but don't auto-play — let user press the button
      player.load({ digestId, title, audioUrl }, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, audioUrl]);

  // Poll while pending/generating
  useEffect(() => {
    if (status !== "pending" && status !== "generating") return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/audio/${digestId}`);
        const data = await res.json();
        if (data.status === "completed" || data.status === "failed") {
          setStatus(data.status);
          setAudioUrl(data.audio_url ?? null);
          clearInterval(iv);
        } else {
          setStatus(data.status);
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [digestId, status]);

  const handleGenerate = async () => {
    setIsStarting(true);
    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_id: digestId }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status);
      } else {
        alert(data.error ?? "Failed to start generation");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!isActive || player.duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    player.seek(
      Math.max(0, Math.min(player.duration, ((e.clientX - rect.left) / rect.width) * player.duration))
    );
  }

  // ── Completed ──────────────────────────────────────────────────────────────
  if (status === "completed" && audioUrl) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-foreground text-background shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-sm">Audio Brief</p>
            <p className="text-xs text-muted-foreground">Ready to play</p>
          </div>
        </div>

        {/* Scrubber */}
        <div className="space-y-1.5">
          <div
            className="cursor-pointer py-1"
            onClick={handleBarClick}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={Math.round(isActive ? player.duration : 0)}
            aria-valuenow={Math.round(isActive ? player.currentTime : 0)}
            aria-label="Seek"
          >
            <Progress value={progress} className="h-1.5" />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{isActive ? fmt(player.currentTime) : "0:00"}</span>
            <span>{isActive ? fmt(player.duration) : "--:--"}</span>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={player.togglePlayPause}
        >
          {isActive && player.isPlaying ? (
            <><Pause className="w-4 h-4 mr-2" /> Pause</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> Play Audio Brief</>
          )}
        </Button>
      </div>
    );
  }

  // ── Generating ─────────────────────────────────────────────────────────────
  if (status === "pending" || status === "generating") {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        <p className="font-medium text-sm">Generating your audio brief&hellip;</p>
        <p className="text-xs text-muted-foreground">
          This usually takes 20&ndash;40 seconds.
        </p>
      </div>
    );
  }

  // ── Failed ─────────────────────────────────────────────────────────────────
  if (status === "failed") {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
        <p className="font-medium text-sm">Generation failed</p>
        <p className="text-xs text-muted-foreground">Please try again.</p>
        <Button onClick={handleGenerate} disabled={isStarting} variant="outline">
          {isStarting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</>
          ) : (
            "Retry"
          )}
        </Button>
      </div>
    );
  }

  // ── Not found — generate ───────────────────────────────────────────────────
  return (
    <div className="rounded-xl border bg-card p-6 text-center space-y-4">
      <div className="p-4 rounded-full bg-muted mx-auto w-fit">
        <Headphones className="w-8 h-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">Listen to this Brief</p>
        <p className="text-xs text-muted-foreground mt-1">
          Generate an audio version narrated by AI.
        </p>
      </div>
      <Button
        className="w-full"
        onClick={handleGenerate}
        disabled={isStarting}
      >
        {isStarting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</>
        ) : (
          "🎧 Generate Audio Brief"
        )}
      </Button>
    </div>
  );
}
