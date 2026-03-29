"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BriefHeader } from "./BriefHeader";
import { BriefSkeleton } from "./BriefSkeleton";
import { ReadNowButton } from "./ReadNowButton";
import { StoryBlock } from "./StoryBlock";
import { QuickMentions } from "./QuickMentions";
import type { BriefDigest } from "./types";

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 20; // 80 seconds before giving up

type GenerationStatus = "idle" | "generating" | "failed";

interface CurrentResponse {
  digest: BriefDigest | null;
  generationStatus: GenerationStatus;
}

interface BriefContainerProps {
  /** Reserved for /app/brief/[id] */
  digestId?: string;
}

export function BriefContainer({ digestId: _digestId }: BriefContainerProps) {
  const [digest, setDigest] = useState<BriefDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const fetchCurrent = useCallback(async (): Promise<CurrentResponse> => {
    try {
      const res = await fetch("/api/brief/current");
      if (!res.ok) return { digest: null, generationStatus: "idle" };
      return res.json() as Promise<CurrentResponse>;
    } catch {
      return { digest: null, generationStatus: "idle" };
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollCountRef.current = 0;

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      // Safety timeout — stop if the job is taking too long
      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        stopPolling();
        setIsGenerating(false);
        setGenerationError(
          "Brief generation is taking longer than expected. Please try again."
        );
        return;
      }

      const { digest: data, generationStatus } = await fetchCurrent();

      if (data) {
        setDigest(data);
        setIsGenerating(false);
        stopPolling();
        return;
      }

      if (generationStatus === "failed") {
        stopPolling();
        setIsGenerating(false);
        setGenerationError(
          "Brief generation failed. This can happen when sources have no recent items. Try again shortly."
        );
        return;
      }

      if (generationStatus === "idle") {
        // Nothing is generating — the job may have been cleaned up externally.
        // Stop polling so we don't loop forever; leave isGenerating true briefly
        // so the UI doesn't flicker; the user can click "Read now" again.
        stopPolling();
        setIsGenerating(false);
        return;
      }
      // generationStatus === "generating" → keep polling
    }, POLL_INTERVAL_MS);
  }, [fetchCurrent, stopPolling]);

  useEffect(() => {
    fetchCurrent().then(({ digest: data, generationStatus }) => {
      setDigest(data);
      setIsLoading(false);
      // If something is already generating when the page loads (e.g. the user
      // was redirected here after adding a source), auto-start polling so the
      // brief appears without requiring a manual "Read now" click.
      if (!data && generationStatus === "generating") {
        setIsGenerating(true);
        startPolling();
      }
    });
    return stopPolling;
  }, [fetchCurrent, stopPolling, startPolling]);

  function handleGenerate() {
    setIsGenerating(true);
    setGenerationError(null);
    startPolling();
  }

  if (isLoading) return <BriefSkeleton />;

  if (generationError) {
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Your Brief</h1>
            <p className="text-sm text-destructive">{generationError}</p>
          </div>
          <ReadNowButton onGenerate={handleGenerate} />
        </div>
      </div>
    );
  }

  if (isGenerating && !digest) {
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Your Brief</h1>
            <p className="text-sm text-muted-foreground">Generating…</p>
          </div>
        </div>
        <BriefSkeleton inline />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Your Brief</h1>
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          </div>
          <ReadNowButton onGenerate={handleGenerate} />
        </div>
        <p className="text-sm text-muted-foreground">
          Add sources, then click{" "}
          <strong className="font-medium text-foreground">Read now</strong> to
          generate your first Brief.
        </p>
      </div>
    );
  }

  const fullBlocks = digest.clusters.filter((c) => c.isFullBlock);
  const shortMentions = digest.clusters.filter((c) => !c.isFullBlock);

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="flex items-start justify-between gap-4 mb-8">
        <BriefHeader
          periodLabel={digest.periodLabel}
          subject={digest.subject}
        />
        <ReadNowButton onGenerate={handleGenerate} />
      </div>

      {fullBlocks.length > 0 && (
        <div className="space-y-4">
          {fullBlocks.map((cluster, i) => (
            <StoryBlock key={cluster.id} cluster={cluster} isLead={i < 2} />
          ))}
        </div>
      )}

      {shortMentions.length > 0 && (
        <div className="mt-4">
          <QuickMentions clusters={shortMentions} />
        </div>
      )}
    </div>
  );
}
