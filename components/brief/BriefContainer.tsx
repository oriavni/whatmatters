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

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 20; // 80 seconds before giving up
/** How often to poll for items while sources are being processed (first-time users). */
const FRESHNESS_POLL_MS = 5000;

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

interface FreshnessData {
  newCount: number;
  /** ISO timestamp of the most recent completed digest, or null for first-time users. */
  lastDigestAt: string | null;
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

async function fetchFreshness(): Promise<FreshnessData | null> {
  try {
    const res = await fetch("/api/brief/freshness");
    if (!res.ok) return null;
    return res.json() as Promise<FreshnessData>;
  } catch {
    return null;
  }
}

export function BriefContainer({
  digestId: _digestId,
  inboundAddress = "",
  hasSourcesInitial = false,
  isPremiumInitial = false,
}: BriefContainerProps) {
  const [digest, setDigest] = useState<BriefDigest | null>(null);
  const [interactions, setInteractions] = useState<Interactions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSampleGenerating, setIsSampleGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [hasSources, setHasSources] = useState(hasSourcesInitial);
  const [isFirstTimeGenerating, setIsFirstTimeGenerating] = useState(false);
  // null = still loading from API; number = resolved
  const [newCount, setNewCount] = useState<number | null>(null);
  /**
   * undefined  = freshness not yet loaded
   * null       = no previous completed digest (first-time user)
   * string     = ISO timestamp of last completed digest (returning user)
   */
  const [lastDigestAt, setLastDigestAt] = useState<string | null | undefined>(undefined);
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
        // Refresh freshness after a digest lands so the ReadNow button resets
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

  // ── Initial load: fetch digest + freshness in parallel ──────────────────────
  useEffect(() => {
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
          // Freshness API unavailable — use a non-null sentinel so we don't
          // get stuck in the processing state. The generate button is still usable.
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
  }, [fetchCurrent, stopPolling, startPolling]);

  // ── Poll freshness while in "processing" state ───────────────────────────────
  // Active for all first-time users (no previous digest) with no digest yet,
  // regardless of hasSources — newsletter sources are auto-created by the backend
  // when an inbound email arrives, so hasSources in UI state may still be false
  // even though the DB already has items ready to generate.
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

    // Don't double-start if already running
    if (freshnessPollRef.current) return;

    freshnessPollRef.current = setInterval(async () => {
      const result = await fetchFreshness();
      if (result && result.newCount > 0) {
        setNewCount(result.newCount);
        setLastDigestAt(result.lastDigestAt);
        // A source was auto-created by the email backend — reflect that in UI
        // so the "You're ready" state renders correctly even if the user never
        // explicitly added a source via the AddSourceDialog.
        setHasSources(true);
        stopFreshnessPoll();
      }
    }, FRESHNESS_POLL_MS);

    return stopFreshnessPoll;
  }, [isLoading, digest, isGenerating, lastDigestAt, newCount, stopFreshnessPoll]);

  // Called by ReadNowButton — the API POST has already been made by the button itself
  // before it calls this. We only need to update UI state and start polling.
  function handleGenerate() {
    setIsGenerating(true);
    setGenerationError(null);
    startPolling();
  }

  // Called by the first-time "Generate your first Brief" button (BriefEmptyState).
  // ReadNowButton isn't in the picture here, so we must POST to the API ourselves.
  async function handleFirstTimeGenerate() {
    console.log("[handleFirstTimeGenerate] button clicked — POSTing to /api/brief/generate");
    setIsFirstTimeGenerating(true);
    try {
      const res = await fetch("/api/brief/generate", { method: "POST" });
      console.log("[handleFirstTimeGenerate] response status:", res.status);

      if (res.status === 409) {
        console.log("[handleFirstTimeGenerate] 409 — generation already in progress, starting poll");
        handleGenerate();
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[handleFirstTimeGenerate] error response:", res.status, body);
        const msg = body.error ?? `Unexpected error (${res.status})`;
        toast.error(msg);
        setGenerationError(msg);
        return;
      }

      console.log("[handleFirstTimeGenerate] success — starting poll");
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

  if (isLoading) return <BriefSkeleton />;

  if (generationError) {
    const isFirstTimeUser = lastDigestAt === null;
    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="mb-8">
          <PageHeader title="Your Brief">
            <div className="flex items-center gap-2 shrink-0">
              <GenerateAudioButton isPremium={isPremiumInitial} hasDigest={false} hasSources={hasSources} />
              {/* Always show ReadNow; first-time users see it disabled with tooltip */}
              <ReadNowButton
                onGenerate={handleGenerate}
                disabled={isFirstTimeUser || !hasSources}
                disabledTooltip={isFirstTimeUser ? "Generate your first Brief below" : "Add at least one source to generate your Brief"}
                newCount={(!isFirstTimeUser && hasSources) ? newCount : undefined}
              />
            </div>
          </PageHeader>
        </div>
        <Alert variant="destructive">
          <AlertDescription>{generationError}</AlertDescription>
        </Alert>
        {/* First-time users: show retry button below the error */}
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
    // isFirstTimeUser: no completed digest has ever been generated for this user.
    // Derived solely from lastDigestAt (null = no prior digest), NOT from newCount.
    // This is the single gate that splits the two mutually exclusive UI modes:
    //   true  → show onboarding/processing/ready-first; hide ReadNow
    //   false → show ReadNow (normal mode); hide onboarding UI
    const isFirstTimeUser = lastDigestAt === null;

    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className="mb-8">
          <PageHeader title="Your Brief">
            <div className="flex items-center gap-2 shrink-0">
              <GenerateAudioButton isPremium={isPremiumInitial} hasDigest={false} hasSources={hasSources} />
              {/* Always show ReadNow; first-time users see it greyed out */}
              <ReadNowButton
                onGenerate={handleGenerate}
                disabled={isFirstTimeUser || !hasSources}
                disabledTooltip={isFirstTimeUser ? "Generate your first Brief below" : "Add at least one source to generate your Brief"}
                newCount={(!isFirstTimeUser && hasSources) ? newCount : undefined}
              />
            </div>
          </PageHeader>
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
      <div className="flex items-start justify-between gap-4 mb-8">
        <BriefHeader periodLabel={digest.periodLabel} subject={digest.subject} />
        <div className="flex items-center gap-2 shrink-0">
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
