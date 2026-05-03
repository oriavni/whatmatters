"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, Loader2, Mail, Rss, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddSourceDialog } from "@/components/sources/AddSourceDialog";
import Link from "next/link";

// ─── Inline copy helper ───────────────────────────────────────────────────────
function InlineCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silent fail
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copy address"
    >
      {copied ? (
        <Check className="size-3.5 text-green-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "onboarding" | "processing" | "ready-first";

interface BriefEmptyStateProps {
  inboundAddress: string;
  hasSources: boolean;
  /**
   * Items since last digest. null = freshness still loading.
   * Used only to detect when sources have been read and items are available
   * (processing → ready-first transition). Does NOT determine first-time state.
   */
  newCount: number | null;
  onSampleGenerate: () => Promise<void>;
  isSampleGenerating: boolean;
  onGenerate: () => void | Promise<void>;
  /** True while the first-time generate POST is in flight — disables + shows spinner on button */
  isGeneratingFirst?: boolean;
  /** Called immediately after a source is successfully added */
  onSourceAdded?: () => void;
}

/**
 * Compute display phase from props (no internal state needed).
 *
 * This component is only rendered for first-time users (lastDigestAt === null),
 * so we don't need an isFirstTimeUser prop — it's always implicitly true here.
 *
 * onboarding  — no sources yet
 * processing  — sources added, items not yet available (RSS still being fetched)
 * ready-first — items available → show "Generate your first Brief" CTA
 */
function getPhase(
  hasSources: boolean,
  newCount: number | null,
  isGeneratingFirst: boolean,
): Phase {
  if (!hasSources) return "onboarding";
  // Once generation has been kicked off, never flash back to "processing"
  if (isGeneratingFirst) return "ready-first";
  if (newCount !== null && newCount > 0) return "ready-first";
  return "processing";
}

// ─── Component ────────────────────────────────────────────────────────────────
export function BriefEmptyState({
  inboundAddress,
  hasSources,
  newCount,
  onSampleGenerate,
  isSampleGenerating,
  onGenerate,
  isGeneratingFirst = false,
  onSourceAdded,
}: BriefEmptyStateProps) {
  const phase = getPhase(hasSources, newCount, isGeneratingFirst);

  // ── Processing state: source added, waiting for first items ───────────────
  if (phase === "processing") {
    return (
      <div key="processing" className="space-y-4 animate-in fade-in-0 duration-300">
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

  // ── Ready-first state: items available, waiting to generate first digest ───
  if (phase === "ready-first") {
    return (
      <div key="ready-first" className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        {/* Success banner */}
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="size-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-green-900 dark:text-green-200">
              You&apos;re ready
            </p>
            <p className="text-xs text-green-700/80 dark:text-green-400/80">
              Your sources have been read — generate your first Brief now.
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        <Button
          size="default"
          className="w-full sm:w-auto"
          onClick={onGenerate}
          disabled={isGeneratingFirst}
        >
          {isGeneratingFirst ? (
            <>
              <Loader2 className="size-3.5 mr-2 animate-spin" />
              Starting…
            </>
          ) : (
            "Generate your first Brief"
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          You can add more sources anytime from the{" "}
          <Link
            href="/app/sources"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Sources page
          </Link>
          .
        </p>
      </div>
    );
  }

  // ── Onboarding state: no sources yet ──────────────────────────────────────
  return (
    <div key="onboarding" className="space-y-8 animate-in fade-in-0 duration-200">
      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Create your first Brief</h2>
        <p className="text-sm text-muted-foreground">
          Add at least one source, then generate your Brief.
        </p>
      </div>

      {/* Action cards */}
      <div className="space-y-4">

        {/* 1 — RSS */}
        <div className="rounded-lg border bg-card p-4 flex items-start gap-4">
          <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0">
            <Rss className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-medium">Add an RSS feed</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paste any website URL — we&apos;ll detect the feed automatically.
              </p>
            </div>
            <AddSourceDialog onAdded={onSourceAdded}>
              <Button size="sm" variant="outline">
                Add RSS source
              </Button>
            </AddSourceDialog>
          </div>
        </div>

        {/* 2 — Newsletter */}
        <div className="rounded-lg border bg-card p-4 flex items-start gap-4">
          <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0">
            <Mail className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-medium">Forward a newsletter</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Subscribe to any newsletter with your Brief address, or forward
                emails you already receive. Some senders require a confirmation
                email before issues start arriving.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 w-fit max-w-full">
              <span className="text-xs font-mono text-foreground truncate">
                {inboundAddress}
              </span>
              <InlineCopyButton text={inboundAddress} />
            </div>
          </div>
        </div>

        {/* 3 — Sample */}
        <div className="rounded-lg border bg-card p-4 flex items-start gap-4">
          <div className="mt-0.5 rounded-md bg-muted p-2 shrink-0">
            <Sparkles className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="text-sm font-medium">Not sure yet?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preview what a Brief looks like with demo content — no sources
                required.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onSampleGenerate}
              disabled={isSampleGenerating}
            >
              {isSampleGenerating ? "Loading…" : "Generate sample Brief"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
