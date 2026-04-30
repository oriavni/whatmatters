"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BriefHeader } from "./BriefHeader";
import { BriefSkeleton } from "./BriefSkeleton";
import { BriefEmptyState } from "./BriefEmptyState";
import { ReadNowButton } from "./ReadNowButton";
import { StoryBlock } from "./StoryBlock";
import { QuickMentions } from "./QuickMentions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/PageHeader";
import { GenerateAudioButton } from "@/components/audio/GenerateAudioButton";
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
  ignoreLevels: Map<string, number>; // cluster_id → suppress level (1-3)
}

interface BriefContainerProps {
  /** Reserved for /app/brief/[id] */
  digestId?: string;
  /** Inbound email address for this user — shown in the empty state */
  inboundAddress?: string;
  /** Whether the user already has ≥1 active source (SSR value) */
  hasSourcesInitial?: boolean;
}

async function fetchInteractionsForDigest(digest: BriefDigest): Promise<Interactions> {
  const clusterIds = digest.clusters.map((c) => c.id).join(",");
  const empty = { liked: new Set<string>(), saved: new Set<string>(), ignoreLevels: new Map<string, number>() };
  if (!clusterIds) return empty;
  try {
    const res = await fetch(`/api/interactions?cluster_ids=${encodeURIComponent(clusterIds)}`);
    if (!res.ok) return empty;
    const data = await res.json();
    return {
      liked: new Set<string>(data.liked ?? []),
      saved: new Set<string>(data.saved ?? []),
      ignoreLevels: new Map<string, number>(Object.entries(data.ignoreLevels ?? {})),
    };
  } catch {
    return empty;
  }
}

export function BriefContainer({
  digestId: _digestId,
  inboundAddress = "",
  hasSourcesInitial = false,
}: BriefContainerProps) {
  const [digest, setDigest] = useState<BriefDigest | null>(null);
  const [interactions, setInteractions] = useState<Interactions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSampleGenerating, setIsSampleGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [hasSources, setHasSources] = useState(hasSourcesInitial);
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

  async function handleSample() {
    setIsSampleGenerating(true);
    setGenerationError(null);
    try {
      const res = await fetch("/api/brief/sample", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create sample");
      // Sample is immediately ready — fetch it now instead of polling
      const { digest: data, generationStatus } = await fetchCurrent();
      if (data) {
        const inter = await fetchInteractionsForDigest(data);
        setDigest(data);
        setInteractions(inter);
      } else if (generationStatus === "generating") {
        setIsGenerating(true);
        startPolling();
      }
    } catch {
      setGenerationError("Could not load sample Brief. Please try again.");
    } finally {
      setIsSampleGenerating(false);
    }
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
          <PageHeader title="Your Brief">
            <ReadNowButton
              onGenerate={handleGenerate}
              disabled={!hasSources}
            />
          </PageHeader>
        </div>
        <BriefEmptyState
          inboundAddress={inboundAddress}
          hasSources={hasSources}
          onSampleGenerate={handleSample}
          isSampleGenerating={isSampleGenerating}
          onGenerate={handleGenerate}
          onSourceAdded={() => setHasSources(true)}
        />
      </div>
    );
  }

  const fullBlocks = digest.clusters.filter((c) => c.isFullBlock);
  const shortMentions = digest.clusters.filter((c) => !c.isFullBlock);

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="flex items-start justify-between gap-4 mb-8">
        <BriefHeader periodLabel={digest.periodLabel} subject={digest.subject} />
        <div className="flex items-center gap-2 shrink-0">
          <GenerateAudioButton digestId={digest.id} label="🎧 Listen" />
          <ReadNowButton onGenerate={handleGenerate} />
        </div>
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
              initialIgnoreLevel={(interactions?.ignoreLevels.get(cluster.id) ?? 0) as 0 | 1 | 2 | 3}
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
