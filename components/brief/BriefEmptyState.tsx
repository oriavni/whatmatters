"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Rss, Mail, Sparkles, CheckCircle2 } from "lucide-react";
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
type Phase = "onboarding" | "ready";

interface BriefEmptyStateProps {
  inboundAddress: string;
  hasSources: boolean;
  onSampleGenerate: () => Promise<void>;
  isSampleGenerating: boolean;
  onGenerate: () => void;
  /** Called immediately after a source is successfully added */
  onSourceAdded?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function BriefEmptyState({
  inboundAddress,
  hasSources,
  onSampleGenerate,
  isSampleGenerating,
  onGenerate,
  onSourceAdded,
}: BriefEmptyStateProps) {
  const [phase, setPhase] = useState<Phase>(hasSources ? "ready" : "onboarding");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hasSources && phase === "onboarding") {
      setPhase("ready");
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [hasSources, phase]);

  // ── Ready state: source added, waiting to generate ─────────────────────────
  if (phase === "ready") {
    return (
      <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        {/* Success banner */}
        <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="size-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-green-900 dark:text-green-200">
              Source added — ready to generate your first Brief
            </p>
            <p className="text-xs text-green-700/80 dark:text-green-400/80">
              Your sources will be fetched and compiled into a single digest.
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        <Button
          size="default"
          className="w-full sm:w-auto"
          onClick={onGenerate}
        >
          Generate your first Brief
        </Button>

        <p className="text-xs text-muted-foreground">
          You can add more sources anytime from the{" "}
          <Link href="/app/sources" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Sources page
          </Link>
          .
        </p>
      </div>
    );
  }

  // ── Onboarding state ───────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
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
