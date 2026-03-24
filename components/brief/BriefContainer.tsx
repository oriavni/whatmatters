"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BriefHeader } from "./BriefHeader";
import { BriefSkeleton } from "./BriefSkeleton";
import { ReadNowButton } from "./ReadNowButton";
import { StoryBlock } from "./StoryBlock";
import { QuickMentions } from "./QuickMentions";
import type { BriefDigest } from "./types";

const POLL_INTERVAL_MS = 4000;

interface BriefContainerProps {
  /** Reserved for /app/brief/[id] */
  digestId?: string;
}

export function BriefContainer({ digestId: _digestId }: BriefContainerProps) {
  const [digest, setDigest] = useState<BriefDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCurrent = useCallback(async (): Promise<BriefDigest | null> => {
    const res = await fetch("/api/brief/current");
    if (!res.ok) return null;
    const body = (await res.json()) as { digest: BriefDigest | null };
    return body.digest;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const data = await fetchCurrent();
      if (data) {
        setDigest(data);
        setIsGenerating(false);
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [fetchCurrent, stopPolling]);

  useEffect(() => {
    fetchCurrent().then((data) => {
      setDigest(data);
      setIsLoading(false);
    });
    return stopPolling;
  }, [fetchCurrent, stopPolling]);

  function handleGenerate() {
    setIsGenerating(true);
    startPolling();
  }

  if (isLoading) return <BriefSkeleton />;

  if (isGenerating && !digest) {
    return (
      <div className="max-w-2xl mx-auto pb-16">
        <div className="flex items-start justify-between gap-4 mb-10">
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
      <div className="max-w-2xl mx-auto pb-16">
        <div className="flex items-start justify-between gap-4 mb-10">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Your Brief</h1>
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          </div>
          <ReadNowButton onGenerate={handleGenerate} />
        </div>
        <p className="text-sm text-muted-foreground/70 leading-relaxed">
          Add sources, then click <strong className="text-muted-foreground font-medium">Read now</strong> to generate your first Brief.
        </p>
      </div>
    );
  }

  const fullBlocks = digest.clusters.filter((c) => c.isFullBlock);
  const shortMentions = digest.clusters.filter((c) => !c.isFullBlock);

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <BriefHeader
          periodLabel={digest.periodLabel}
          subject={digest.subject}
        />
        <ReadNowButton onGenerate={handleGenerate} />
      </div>

      {/* Full story blocks */}
      {fullBlocks.length > 0 && (
        <div>
          {fullBlocks.map((cluster, i) => (
            <StoryBlock key={cluster.id} cluster={cluster} isLead={i < 2} />
          ))}
        </div>
      )}

      {/* Quick mentions — visually separated section */}
      {shortMentions.length > 0 && (
        <QuickMentions clusters={shortMentions} />
      )}
    </div>
  );
}
