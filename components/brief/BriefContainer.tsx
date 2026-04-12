"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BriefHeader } from "./BriefHeader";
import { BriefSkeleton } from "./BriefSkeleton";
import { ReadNowButton } from "./ReadNowButton";
import { StoryBlock } from "./StoryBlock";
import { QuickMentions } from "./QuickMentions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/PageHeader";
import type { BriefDigest } from "./types";

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 20; // 80 seconds before giving up

type GenerationStatus = "idle" | "generating" | "failed";

interface CurrentResponse {
  digest: BriefDigest | null;
  generationStatus: GenerationStatus;
}

interface Interactions {
  liked: Set<string>;
  saved: Set<string>;
  ignored: Set<string>;
}

interface BriefContainerProps {
  /** Reserved for /app/brief/[id] */
  digestId?: string;
}

async function fetchInteractionsForDigest(digest: BriefDigest): Promise<Interactions> {
  const clusterIds = digest.clusters.map((c) => c.id).join(",");
  if (!clusterIds) return { liked: new Set(), saved: new Set(), ignored: new Set() };
  try {
    const res = await fetch(`/api/interactions?cluster_ids=${encodeURIComponent(clusterIds)}`);
    if (!res.ok) return { liked: new Set(), saved: new Set(), ignored: new Set() };
    const data = await res.json();
    return {
      liked: new Set<string>(data.liked ?? []),
      saved: new Set<string>(data.saved ?? []),
      ignored: new Set<string>(data.ignored ?? []),
    };
  } catch {
    return { liked: new Set(), saved: new Set(), ignored: new Set() };
  }
}

export function BriefContainer({ digestId: _digestId }: BriefContainerProps) {
  const [digest, setDigest] = useState<BriefDigest | null>(null);
  const [interactions, setInteractions] = useState<Interactions | null>(null);
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
        // Fetch interaction states for the newly arrived digest
        const inter = await fetchInteractionsForDigest(data);
        setDigest(data);
        setInteractions(inter);
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
        stopPolling();
        setIsGenerating(false);
        return;
      }
      // generationStatus === "generating" → keep polling
    }, POLL_INTERVAL_MS);
  }, [fetchCurrent, stopPolling]);

  useEffect(() => {
    fetchCurrent().then(async ({ digest: data, generationStatus }) => {
      if (data) {
        // Fetch interaction states before revealing the cards so buttons
        // render with the correct initial state — no flash of inactive state.
        const inter = await fetchInteractionsForDigest(data);
        setDigest(data);
        setInteractions(inter);
      } else {
        setDigest(null);
      }
      setIsLoading(false);
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
        <div className="mb-8">
          <PageHeader title="Your Brief">
            <ReadNowButton onGenerate={handleGenerate} />
          </PageHeader>
        </div>
        <Alert variant="destructive">
          <AlertDescription>{generationError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isGenerating && !digest) {
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="mb-8">
          <PageHeader title="Your Brief" description="Generating…" />
        </div>
        <BriefSkeleton inline />
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="mb-8">
          <PageHeader title="Your Brief" description="Nothing here yet.">
            <ReadNowButton onGenerate={handleGenerate} />
          </PageHeader>
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
        <BriefHeader periodLabel={digest.periodLabel} subject={digest.subject} />
        <ReadNowButton onGenerate={handleGenerate} />
      </div>

      {fullBlocks.length > 0 && (
        <div className="space-y-4">
          {fullBlocks.map((cluster, i) => (
            <StoryBlock
              key={cluster.id}
              cluster={cluster}
              isLead={i < 2}
              digestId={digest.id}
              initialLiked={interactions?.liked.has(cluster.id) ?? false}
              initialSaved={interactions?.saved.has(cluster.id) ?? false}
              initialIgnored={interactions?.ignored.has(cluster.id) ?? false}
            />
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
