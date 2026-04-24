"use client";

import { useState, useEffect, useRef } from "react";
import { Headphones, Play, Pause, Loader2, AlertCircle } from "lucide-react";

interface AudioBriefPlayerProps {
  digestId: string;
  audioUrl: string | null;
  status: string;
  isGenerating: boolean;
}

export function AudioBriefPlayer({
  digestId,
  audioUrl: initialAudioUrl,
  status: initialStatus,
  isGenerating: initialIsGenerating,
}: AudioBriefPlayerProps) {
  const [status, setStatus] = useState(initialStatus);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Poll while pending/generating
  useEffect(() => {
    if (status !== "pending" && status !== "generating") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/audio/${digestId}`);
        const data = await res.json();
        if (data.status === "completed" || data.status === "failed") {
          setStatus(data.status);
          setAudioUrl(data.audio_url ?? null);
          clearInterval(interval);
        } else {
          setStatus(data.status);
        }
      } catch {
        // ignore transient errors
      }
    }, 3000);

    return () => clearInterval(interval);
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

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  if (status === "completed" && audioUrl) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-foreground text-background">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-sm">Audio Brief</p>
            <p className="text-xs text-muted-foreground">Ready to play</p>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={audioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />

        <button
          onClick={togglePlay}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-foreground text-background font-medium text-sm"
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" /> Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Play Audio Brief
            </>
          )}
        </button>
      </div>
    );
  }

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

  if (status === "failed") {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
        <p className="font-medium text-sm">Generation failed</p>
        <p className="text-xs text-muted-foreground">Please try again.</p>
        <button
          onClick={handleGenerate}
          disabled={isStarting}
          className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium disabled:opacity-50"
        >
          {isStarting ? "Starting…" : "Retry"}
        </button>
      </div>
    );
  }

  // not_found — show generate button
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
      <button
        onClick={handleGenerate}
        disabled={isStarting}
        className="w-full py-3 rounded-lg bg-foreground text-background font-medium text-sm disabled:opacity-50"
      >
        {isStarting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Starting…
          </span>
        ) : (
          "🎧 Generate Audio Brief"
        )}
      </button>
    </div>
  );
}
