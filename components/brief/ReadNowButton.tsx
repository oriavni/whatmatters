"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

interface ReadNowButtonProps {
  onGenerate?: () => void;
  /** Hard disabled (e.g. no sources). Shows tooltip. */
  disabled?: boolean;
  disabledTooltip?: string;
  /**
   * New raw items since the last digest.
   * null  = still loading (show neutral label)
   * 0     = no new items (button is auto-disabled)
   * 1–2   = show confirmation modal before generating
   * 3+    = generate immediately
   */
  newCount?: number | null;
}

async function triggerGenerate(): Promise<{ ok: boolean; alreadyInProgress: boolean }> {
  const res = await fetch("/api/brief/generate", { method: "POST" });
  if (res.status === 409) return { ok: true, alreadyInProgress: true };
  return { ok: res.ok, alreadyInProgress: false };
}

export function ReadNowButton({
  onGenerate,
  disabled = false,
  disabledTooltip = "Add at least one source to generate your Brief",
  newCount,
}: ReadNowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Derive effective disabled state
  // newCount === 0 means "no new stories" — treat as disabled regardless of `disabled` prop
  const noNewStories = newCount === 0;
  const isDisabled = disabled || noNewStories;
  const isLoading = newCount === null; // still fetching freshness

  // Button label — "Read now (N)" with 99+ cap
  const displayCount = newCount != null && newCount > 99 ? "99+" : newCount;
  const exactCountTitle = newCount != null && newCount > 99 ? String(newCount) : null;

  function getLabel() {
    if (loading) return "Generating…";
    if (newCount != null && newCount > 0) return `Read now (${displayCount})`;
    return "Read now";
  }

  // Tooltip for the disabled state
  const effectiveTooltip = noNewStories
    ? "No new stories since your last Brief"
    : disabledTooltip;

  async function doGenerate() {
    setLoading(true);
    try {
      const { ok, alreadyInProgress } = await triggerGenerate();
      if (alreadyInProgress) {
        toast.info("Your Brief is already being generated. Check back in a moment.");
        onGenerate?.();
        return;
      }
      if (!ok) throw new Error("Failed to generate Brief");
      toast.success("Generating your Brief — it will appear here shortly.");
      onGenerate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate Brief");
    } finally {
      setLoading(false);
    }
  }

  async function handleClick() {
    if (isDisabled || loading) return;

    // Low-count confirmation gate
    if (newCount != null && newCount > 0 && newCount <= 2) {
      setConfirmOpen(true);
      return;
    }

    await doGenerate();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const btn = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading || isDisabled || isLoading}
      className="shrink-0 gap-1.5"
      style={isDisabled ? { pointerEvents: "none" } : undefined}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Zap className="size-3" />
      )}
      {getLabel()}
    </Button>
  );

  const wrappedBtn = isDisabled ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span tabIndex={0} className="cursor-not-allowed inline-flex" />}>
          {btn}
        </TooltipTrigger>
        <TooltipContent side="bottom">{effectiveTooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : exactCountTitle ? (
    // Show exact count in tooltip when displaying "99+"
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          {btn}
        </TooltipTrigger>
        <TooltipContent side="bottom">{exactCountTitle} new stories</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    btn
  );

  return (
    <>
      {wrappedBtn}

      {/* Low-count confirmation modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Not many new stories</DialogTitle>
            <DialogDescription>
              Only <strong>{newCount}</strong> new{" "}
              {newCount === 1 ? "story" : "stories"} since your last Brief. Your
              digest may be shorter than usual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setConfirmOpen(false);
                await doGenerate();
              }}
            >
              Generate anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
