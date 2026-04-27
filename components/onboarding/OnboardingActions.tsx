"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddSourceDialog } from "@/components/sources/AddSourceDialog";
import { toast } from "sonner";

// ── RSS path ──────────────────────────────────────────────────────────────────

function RssActions() {
  return (
    <AddSourceDialog>
      <Button size="sm" variant="outline">
        Add RSS feed
      </Button>
    </AddSourceDialog>
  );
}

// ── Newsletter path ───────────────────────────────────────────────────────────

function NewsletterActions({ inboundAddress }: { inboundAddress: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(inboundAddress);
    setCopied(true);
    toast.success("Address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded-md truncate">
        {inboundAddress}
      </code>
      <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
      </Button>
    </div>
  );
}

// ── Exports ───────────────────────────────────────────────────────────────────

interface OnboardingActionsProps {
  type: "rss" | "newsletter";
  inboundAddress?: string;
}

export function OnboardingActions({ type, inboundAddress }: OnboardingActionsProps) {
  if (type === "rss") return <RssActions />;
  if (type === "newsletter" && inboundAddress) {
    return <NewsletterActions inboundAddress={inboundAddress} />;
  }
  return null;
}
