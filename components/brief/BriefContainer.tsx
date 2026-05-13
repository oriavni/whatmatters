"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { BriefHeader } from "./BriefHeader";
import { BriefSkeleton } from "./BriefSkeleton";
import { BriefEmptyState } from "./BriefEmptyState";
import { ReadNowButton } from "./ReadNowButton";
import { StoryBlock } from "./StoryBlock";
import { QuickMentions } from "./QuickMentions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/PageHeader";
import { GenerateAudioButton } from "@/components/audio/GenerateAudioButton";
import { toast } from "sonner";
import type { BriefDigest } from "./types";
import type {
  GenerationStatus,
  InteractionsResult,
  FreshnessResult,
} from "@/lib/brief/getCurrentBrief";

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 20; // 80 seconds before giving up
/** How often to poll for items while sources are being processed (first-time users). */
const FRESHNESS_POLL_MS = 5000;

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
  /** Whether the user is on a premium or trial plan (SSR value) */
  isPremiumInitial?: boolean;
  // ── SSR-prefetched data (eliminates skeleton flash on initial load) ──
  initialDigest?: BriefDigest | null;
  initialGenerationStatus?: GenerationStatus;
  initialFreshness?: FreshnessResult | null;
  initialInteractions?: InteractionsResult | null;
}

function interactionsFromSSR(raw: InteractionsResult | null | undefined): Interactions {
  if (!raw) return { liked: new Set(), saved: new Set(), ignoreLevels: new Map() };
  return {
    liked: new Set(raw.liked),
    saved: new Set(raw.saved),
    ignoreLevels: new Map(Object.entries(raw.ignoreLevels)),
  };
}

async function fetchInteractionsForDigest(digest: BriefDigest): Promise<Interactions> {
  const clusterIds = digest.clusters.map((c) => c.id).join(",");
  const empty: Interactions = { liked: new Set(), saved: new Set(), ignoreLevels: new Map() };
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

async function fetchFreshness(): Promise<{ newCount: number; lastDigestAt: string | null } | null> {
  try {
    const res = await fetch("/api/brief/freshness");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function BriefContainer({
  digestId: _digestId,
  inboundAddress = "",
  hasSourcesInitial = false,
  isPremiumInitial = false,
  initialDigest,
  initialGenerationStatus = "idle",
  initialFreshness,
  initialInteractions,
}: BriefContainerProps) {
  // ── Initialise from SSR data — no loading flash when a digest already exists ──
  const hasSSRData = initialDigest !== undefined;

  const [digest, setDigest] = useState<BriefDigest | null>(initialDigest ?? null);
  const [interactions, setInteractions] = useState<Interactions | null>(
    initialDigest ? interactionsFromSSR(initialInteractions) : null
  );
  // If SSR provided data, we're already loaded; otherwise show skeleton until
  // the client fetch completes (e.g. /app/brief/[id] which doesn't SSR-prefetch).
  const [isLoading, setIsLoading] = useState(!hasSSRData);
  const [isGenerating, setIsGenerating] = useState(
    !hasSSRData ? false : initialGenerationStatus === "generating"
  );
  const [isSampleGenerating, setIsSampleGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [hasSources, setHasSources] = useState(hasSourcesInitial);
  const [isFirstTimeGenerating, setIsFirstTimeGenerating] = useState(false);

  // Freshness is always null on SSR (deferred to client). Start with 0/null so
  // the UI renders correctly before the client fetch resolves.
  const [newCount, setNewCount] = useState<number | null>(
    initialFreshness?.newCount ?? (hasSSRData ? 0 : null)
  );
  const [lastDigestAt, setLastDigestAt] = useState<string | null | undefined>(
    // If SSR provided a digest, user is not first-time regardless of freshness.
    // If no digest, null means "first-time user" which is the safe default until
    // the client-side freshness fetch corrects it.
    hasSSRData ? (initialFreshness?.lastDigestAt ?? null) : undefined
  );

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const freshnessPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const stopFreshnessPoll = useCallback(() => {
    if (freshnessPollRef.current) {
      clearInterval(freshnessPollRef.current);
      freshnessPollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollCountRef.current = 0;

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;

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
        const inter = await fetchInteractionsForDigest(data);
        setDigest(data);
        setInteractions(inter);
        setIsGenerating(false);
        stopPolling();
        fetchFreshness().then((result) => {
          if (result) {
            setNewCount(result.newCount);
            setLastDigestAt(result.lastDigestAt);
          }
        });
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
    }, POLL_INTERVAL_MS);
  }, [fetchCurrent, stopPolling]);

  // ── Initial load — only runs when SSR data was NOT provided (e.g. /brief/[id]) ──
  useEffect(() => {
    if (hasSSRData) return; // SSR handled everything; skip client fetch

    Promise.all([fetchCurrent(), fetchFreshness()]).then(
      async ([{ digest: data, generationStatus }, freshness]) => {
        if (data) {
          const inter = await fetchInteractionsForDigest(data);
          setDigest(data);
          setInteractions(inter);
        } else {
          setDigest(null);
        }
        if (freshness) {
          setNewCount(freshness.newCount);
          setLastDigestAt(freshness.lastDigestAt);
        } else {
          setNewCount(0);
          setLastDigestAt("unavailable");
        }
        setIsLoading(false);
        if (!data && generationStatus === "generating") {
          setIsGenerating(true);
          startPolling();
        }
      }
    );
    return stopPolling;
  }, [hasSSRData, fetchCurrent, stopPolling, startPolling]);

  // If SSR reported generation in progress, start polling immediately
  useEffect(() => {
    if (!hasSSRData) return;
    if (initialGenerationStatus === "generating") {
      setIsGenerating(true);
      startPolling();
    }
    return stopPolling;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // Fetch interactions client-side after first paint when SSR didn't provide them
  // (deferred from critical path so they don't delay page render).
  useEffect(() => {
    if (!hasSSRData || !initialDigest || initialInteractions !== null) return;
    fetchInteractionsForDigest(initialDigest).then(setInteractions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // Freshness is always fetched client-side after first paint — the COUNT query
  // is too slow (~7s) to include in the SSR critical path.
  useEffect(() => {
    if (!hasSSRData) return; // non-SSR path fetches freshness in the initial load effect
    fetchFreshness().then((result) => {
      if (result) {
        setNewCount(result.newCount);
        setLastDigestAt(result.lastDigestAt);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // ── Poll freshness while in first-time "processing" state ────────────────────
  useEffect(() => {
    const shouldPoll =
      !isLoading &&
      !digest &&
      !isGenerating &&
      lastDigestAt === null &&
      newCount === 0;

    if (!shouldPoll) {
      stopFreshnessPoll();
      return;
    }

    if (freshnessPollRef.current) return;

    freshnessPollRef.current = setInterval(async () => {
      const result = await fetchFreshness();
      if (result && result.newCount > 0) {
        setNewCount(result.newCount);
        setLastDigestAt(result.lastDigestAt);
        setHasSources(true);
        stopFreshnessPoll();
      }
    }, FRESHNESS_POLL_MS);

    return stopFreshnessPoll;
  }, [isLoading, digest, isGenerating, lastDigestAt, newCount, stopFreshnessPoll]);

  function handleGenerate() {
    setIsGenerating(true);
    setGenerationError(null);
    startPolling();
  }

  async function handleFirstTimeGenerate() {
    console.log("[handleFirstTimeGenerate] button clicked — POSTing to /api/brief/generate");
    setIsFirstTimeGenerating(true);
    try {
      const res = await fetch("/api/brief/generate", { method: "POST" });
      console.log("[handleFirstTimeGenerate] response status:", res.status);

      if (res.status === 409) {
        handleGenerate();
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? `Unexpected error (${res.status})`;
        toast.error(msg);
        setGenerationError(msg);
        return;
      }

      handleGenerate();
    } catch (err) {
      console.error("[handleFirstTimeGenerate] fetch threw:", err);
      const msg = "Failed to generate Brief. Please try again.";
      toast.error(msg);
      setGenerationError(msg);
    } finally {
      setIsFirstTimeGenerating(false);
    }
  }

  async function handleSample() {
    setIsSampleGenerating(true);
    setGenerationError(null);
    try {
      const res = await fetch("/api/brief/sample", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create sample");
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

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) return <BriefSkeleton />;

  if (generationError) {
    const isFirstTimeUser = lastDigestAt === null;
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="space-y-3 mb-8">
          <PageHeader title="Your Brief" />
          <div className="flex items-center gap-2">
            <GenerateAudioButton isPremium={isPremiumInitial} hasDigest={false} hasSources={hasSources} />
            <ReadNowButton
              onGenerate={handleGenerate}
              disabled={isFirstTimeUser || !hasSources}
              disabledTooltip={isFirstTimeUser ? "Generate your first Brief below" : "Add at least one source to generate your Brief"}
              newCount={(!isFirstTimeUser && hasSources) ? newCount : undefined}
            />
          </div>
        </div>
        <Alert variant="destructive">
          <AlertDescription>{generationError}</AlertDescription>
        </Alert>
        {isFirstTimeUser && hasSources && (
          <div className="mt-6">
            <button
              onClick={() => {
                setGenerationError(null);
                void handleFirstTimeGenerate();
              }}
              className="text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isGenerating && !digest) {
    return (
      <div className="max-w-2xl mx-auto pb-12 animate-in fade-in-0 duration-300">
        <div className="mb-8">
          <PageHeader title="Your Brief" />
        </div>
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Reading your sources…</p>
            <p className="text-xs text-muted-foreground">This takes a few seconds</p>
          </div>
        </div>
      </div>
    );
  }

  if (!digest) {
    const isFirstTimeUser = lastDigestAt === null;
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="space-y-3 mb-8">
          <PageHeader title="Your Brief" />
          <div className="flex items-center gap-2">
            <GenerateAudioButton isPremium={isPremiumInitial} hasDigest={false} hasSources={hasSources} />
            <ReadNowButton
              onGenerate={handleGenerate}
              disabled={isFirstTimeUser || !hasSources}
              disabledTooltip={isFirstTimeUser ? "Generate your first Brief below" : "Add at least one source to generate your Brief"}
              newCount={(!isFirstTimeUser && hasSources) ? newCount : undefined}
            />
          </div>
        </div>
        {isFirstTimeUser && (
          <BriefEmptyState
            inboundAddress={inboundAddress}
            hasSources={hasSources}
            newCount={newCount}
            onSampleGenerate={handleSample}
            isSampleGenerating={isSampleGenerating}
            onGenerate={handleFirstTimeGenerate}
            isGeneratingFirst={isFirstTimeGenerating}
            onSourceAdded={() => setHasSources(true)}
          />
        )}
      </div>
    );
  }

  const fullBlocks = digest.clusters.filter((c) => c.isFullBlock);
  const shortMentions = digest.clusters.filter((c) => !c.isFullBlock);

  return (
    <div className="max-w-2xl mx-auto pb-12 animate-in fade-in-0 duration-500">
      <div className="space-y-3 mb-8">
        <BriefHeader periodLabel={digest.periodLabel} subject={digest.subject} />
        <div className="flex items-center gap-2">
          <GenerateAudioButton
            digestId={digest.id}
            isPremium={isPremiumInitial}
            hasDigest={true}
            hasSources={true}
          />
          <ReadNowButton onGenerate={handleGenerate} newCount={newCount} isGenerating={isGenerating} />
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
