"use client";

import { useState } from "react";
import { CheckCircle, Loader2, Rss, Mail, SplitSquareHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddSourceDialogProps {
  /** Called after a source is successfully added */
  onAdded?: () => void;
  children: React.ReactElement;
}

type Phase =
  | { kind: "input" }
  | { kind: "detecting" }
  | { kind: "detected_rss"; feed_url: string; feed_title: string }
  | { kind: "detected_ambiguous"; feed_url: string; feed_title: string; brief_address: string | null }
  | { kind: "detected_newsletter"; brief_address: string | null; message: string }
  | { kind: "detected_unknown"; message: string }
  | { kind: "adding" }
  | { kind: "added"; source_name: string }
  | { kind: "error"; message: string };

export function AddSourceDialog({ onAdded, children }: AddSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "input" });

  function reset() {
    setInput("");
    setPhase({ kind: "input" });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleDetect(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setPhase({ kind: "detecting" });

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detect", input: input.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPhase({ kind: "error", message: data.error ?? "Detection failed." });
        return;
      }

      if (data.detected_type === "rss") {
        setPhase({
          kind: "detected_rss",
          feed_url: data.feed_url,
          feed_title: data.feed_title,
        });
      } else if (data.detected_type === "ambiguous") {
        setPhase({
          kind: "detected_ambiguous",
          feed_url: data.feed_url,
          feed_title: data.feed_title,
          brief_address: data.brief_address ?? null,
        });
      } else if (data.detected_type === "newsletter") {
        setPhase({
          kind: "detected_newsletter",
          brief_address: data.brief_address ?? null,
          message: data.message,
        });
      } else {
        setPhase({ kind: "detected_unknown", message: data.message });
      }
    } catch {
      setPhase({ kind: "error", message: "Network error. Please try again." });
    }
  }

  async function handleAdd(feed_url: string, feed_title: string) {
    setPhase({ kind: "adding" });

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", feed_url, feed_title }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPhase({ kind: "error", message: data.error ?? "Failed to add source." });
        return;
      }

      setPhase({ kind: "added", source_name: data.source?.name ?? feed_title });
      onAdded?.();
    } catch {
      setPhase({ kind: "error", message: "Network error. Please try again." });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Input phase */}
          {(phase.kind === "input" || phase.kind === "detecting") && (
            <form onSubmit={handleDetect} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="source-url">URL or RSS feed</Label>
                <Input
                  id="source-url"
                  type="text"
                  placeholder="example.com or https://example.com/feed"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={phase.kind === "detecting"}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Paste a website URL and we&apos;ll find the RSS feed automatically.
                </p>
              </div>
              <Button
                type="submit"
                disabled={!input.trim() || phase.kind === "detecting"}
                className="w-full"
              >
                {phase.kind === "detecting" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Detecting…
                  </>
                ) : (
                  "Detect feed"
                )}
              </Button>
            </form>
          )}

          {/* RSS detected */}
          {(phase.kind === "detected_rss" || phase.kind === "adding") && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Rss className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">RSS feed found</p>
                  <p className="mt-0.5 text-sm text-muted-foreground truncate">
                    {phase.kind === "detected_rss" ? phase.feed_title : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPhase({ kind: "input" })}
                  disabled={phase.kind === "adding"}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={phase.kind === "adding"}
                  onClick={() => {
                    if (phase.kind === "detected_rss") {
                      handleAdd(phase.feed_url, phase.feed_title);
                    }
                  }}
                >
                  {phase.kind === "adding" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    "Add feed"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Ambiguous: has both RSS feed and newsletter option */}
          {phase.kind === "detected_ambiguous" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border p-3">
                <SplitSquareHorizontal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Two ways to follow this</p>
                  <p className="text-sm text-muted-foreground">
                    This source has an RSS feed and is also a newsletter. Choose how you&apos;d like to receive it.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* RSS option */}
                <button
                  type="button"
                  onClick={() => handleAdd(phase.feed_url, phase.feed_title)}
                  className="flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Rss className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Add as RSS feed</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      WhatMatters fetches new posts automatically.
                    </p>
                  </div>
                </button>

                {/* Newsletter / email option */}
                <div className="flex flex-col items-start gap-2 rounded-md border p-3">
                  <Mail className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Subscribe via email</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Forward newsletters to your Brief address.
                    </p>
                  </div>
                  {phase.brief_address && (
                    <code className="mt-1 block w-full rounded bg-muted px-2 py-1 text-xs font-mono break-all">
                      {phase.brief_address}
                    </code>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPhase({ kind: "input" })}
              >
                Back
              </Button>
            </div>
          )}

          {/* Newsletter detected */}
          {phase.kind === "detected_newsletter" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">This is a newsletter</p>
                  <p className="text-sm text-muted-foreground">{phase.message}</p>
                  {phase.brief_address && (
                    <p className="mt-2 text-sm">
                      Use your Brief address to subscribe to new newsletters, or
                      as a forwarding destination for ones you already receive:
                      <br />
                      <code className="mt-1 inline-block rounded bg-muted px-2 py-1 text-xs font-mono">
                        {phase.brief_address}
                      </code>
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPhase({ kind: "input" })}
              >
                Back
              </Button>
            </div>
          )}

          {/* Unknown */}
          {phase.kind === "detected_unknown" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{phase.message}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPhase({ kind: "input" })}
              >
                Try another URL
              </Button>
            </div>
          )}

          {/* Success */}
          {phase.kind === "added" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-md border p-3">
                <CheckCircle className="size-4 shrink-0 text-muted-foreground" />
                <p className="text-sm">
                  <span className="font-medium">{phase.source_name}</span> added.
                  We&apos;re fetching it now — use <strong>Read now</strong> in a moment to generate your Brief.
                </p>
              </div>
              <Button className="w-full" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          )}

          {/* Error */}
          {phase.kind === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-destructive">{phase.message}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPhase({ kind: "input" })}
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
