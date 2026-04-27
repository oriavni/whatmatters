"use client";

import { useState } from "react";
import { Check, Copy, Rss, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddSourceDialog } from "@/components/sources/AddSourceDialog";

interface BriefEmptyStateProps {
  inboundAddress: string;
  onSampleGenerate: () => Promise<void>;
  isSampleGenerating: boolean;
}

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

export function BriefEmptyState({
  inboundAddress,
  onSampleGenerate,
  isSampleGenerating,
}: BriefEmptyStateProps) {
  return (
    <div className="space-y-8 max-w-lg">
      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Create your first Brief</h2>
        <p className="text-sm text-muted-foreground">
          Add at least one source, then generate your Brief.
        </p>
      </div>

      {/* Actions */}
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
            <AddSourceDialog>
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

      {/* Audio note */}
      <p className="text-xs text-muted-foreground">
        🎧 You&apos;ll be able to listen once your Brief is generated.
      </p>
    </div>
  );
}
