"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface AudioStatusResponse {
  status: "completed" | "pending" | "generating" | "not_found" | "failed";
}

interface GenerateAudioButtonProps {
  digestId?: string;
  /** Is the user on a premium or trial plan? */
  isPremium: boolean;
  /** Does a completed digest exist to generate audio from? */
  hasDigest: boolean;
  /** Does the user have at least one source? */
  hasSources?: boolean;
}

function getDisabledTooltip({
  hasSources,
  hasDigest,
  isPremium,
}: {
  hasSources: boolean;
  hasDigest: boolean;
  isPremium: boolean;
}): string | null {
  if (!hasSources) return "Generate a Brief first to listen";
  if (!hasDigest) return "Generate a Brief to create an Audio version";
  if (!isPremium) return "Upgrade to create an Audio Brief from your digest";
  return null;
}

export function GenerateAudioButton({
  digestId,
  isPremium,
  hasDigest,
  hasSources = false,
}: GenerateAudioButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const disabledTooltip = getDisabledTooltip({ hasSources, hasDigest, isPremium });
  const isDisabled = disabledTooltip !== null;

  async function handleClick() {
    if (isDisabled || loading || !digestId) return;
    setLoading(true);
    try {
      const statusRes = await fetch(`/api/audio/${digestId}`);
      if (!statusRes.ok) {
        toast.error("Could not check audio status. Please try again.");
        return;
      }
      const statusData: AudioStatusResponse = await statusRes.json();

      if (
        statusData.status === "completed" ||
        statusData.status === "pending" ||
        statusData.status === "generating"
      ) {
        router.push(`/app/audio-briefs/${digestId}`);
        return;
      }

      const genRes = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_id: digestId }),
      });
      const genData = await genRes.json();

      if (genRes.ok) {
        router.push(`/app/audio-briefs/${digestId}`);
      } else {
        toast.error(genData.error ?? "Failed to start audio generation");
        setLoading(false);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const btn = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading || isDisabled}
      className="shrink-0 gap-1.5"
      style={isDisabled ? { pointerEvents: "none" } : undefined}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Headphones className="size-3" />
      )}
      {loading ? "Starting…" : "Listen"}
    </Button>
  );

  if (isDisabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="cursor-not-allowed inline-flex">
              {btn}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{disabledTooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return btn;
}
