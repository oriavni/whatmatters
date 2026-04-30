"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  /** When true, the button is non-interactive and shows a tooltip explaining why */
  disabled?: boolean;
  disabledTooltip?: string;
}

export function ReadNowButton({
  onGenerate,
  disabled = false,
  disabledTooltip = "Add at least one source to generate your Brief",
}: ReadNowButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleReadNow() {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/brief/generate", { method: "POST" });

      if (res.status === 409) {
        toast.info("Your Brief is already being generated. Check back in a moment.");
        onGenerate?.();
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to generate Brief");
      }

      toast.success("Generating your Brief — it will appear here shortly.");
      onGenerate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate Brief");
    } finally {
      setLoading(false);
    }
  }

  const btn = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReadNow}
      disabled={loading || disabled}
      className="shrink-0 gap-1.5"
      // Keep pointer-events on so the tooltip fires over a disabled button
      style={disabled ? { pointerEvents: "none" } : undefined}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Zap className="size-3" />
      )}
      {loading ? "Generating…" : "Read now"}
    </Button>
  );

  if (!disabled) return btn;

  return (
    <TooltipProvider>
      <Tooltip>
        {/* span wrapper needed: tooltips don't fire on disabled form elements */}
        <TooltipTrigger render={<span tabIndex={0} className="cursor-not-allowed inline-flex" />}>
          {btn}
        </TooltipTrigger>
        <TooltipContent side="bottom">{disabledTooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
