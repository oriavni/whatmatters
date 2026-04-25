"use client";

import { Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAudioPlayer } from "@/lib/audio/player-context";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GlobalAudioPlayer() {
  const { track, isPlaying, currentTime, duration, togglePlayPause, seek, close } =
    useAudioPlayer();

  if (!track) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(Math.max(0, Math.min(duration, ratio * duration)));
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
        {/* Play / pause */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8"
          onClick={togglePlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>

        {/* Track info + scrubber */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate leading-none mb-1.5">
            {track.title}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground tabular-nums w-7 shrink-0">
              {fmt(currentTime)}
            </span>
            {/* Clickable progress bar */}
            <div
              className="flex-1 cursor-pointer py-1"
              onClick={handleBarClick}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-label="Seek"
            >
              <Progress value={progress} className="h-1" />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums w-7 shrink-0 text-right">
              {fmt(duration)}
            </span>
          </div>
        </div>

        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8 text-muted-foreground"
          onClick={close}
          aria-label="Close player"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
