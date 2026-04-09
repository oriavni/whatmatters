"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ThumbsUp, Bookmark, BellOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StoryBlockActionsProps {
  digestId: string;
  clusterId: string;
  sourceUrl: string | null;
}

async function sendFeedback(
  eventType: string,
  digestId: string,
  clusterId: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        digest_id: digestId,
        cluster_id: clusterId,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error((data as { error?: string }).error ?? "Could not save feedback");
      return false;
    }
    return true;
  } catch {
    toast.error("Could not save feedback");
    return false;
  }
}

export function StoryBlockActions({
  digestId,
  clusterId,
  sourceUrl,
}: StoryBlockActionsProps) {
  const [active, setActive] = useState<Set<string>>(new Set());

  async function handleAction(eventType: string) {
    const ok = await sendFeedback(eventType, digestId, clusterId);
    if (ok) {
      setActive((prev) => new Set([...prev, eventType]));
      if (eventType === "ignore_topic") {
        toast.success("Topic ignored — we'll show it less often");
      }
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <ActionIcon
        icon={ThumbsUp}
        label="Like"
        active={active.has("like")}
        onClick={() => handleAction("like")}
      />
      <ActionIcon
        icon={Bookmark}
        label="Save"
        active={active.has("save")}
        onClick={() => handleAction("save")}
      />
      <ActionIcon
        icon={BellOff}
        label="Ignore topic"
        active={active.has("ignore_topic")}
        onClick={() => handleAction("ignore_topic")}
      />
      {sourceUrl && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                render={
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                nativeButton={false}
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
              />
            }
          >
            <ExternalLink className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Read original</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function ActionIcon({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      {/*
       * onClick is placed on TooltipTrigger (not on the render Button) so it
       * lands in elementProps and is merged cleanly into the final button element
       * by Base UI's useRenderElement. Placing it inside render={} requires it to
       * survive a cloneElement + mergeProps chain, which can silently drop it.
       */}
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              active && "text-foreground"
            )}
          />
        }
        onClick={onClick}
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
