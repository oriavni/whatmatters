"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ThumbsUp, Bookmark, BellOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface StoryBlockActionsProps {
  digestId: string;
  clusterId: string;
  sourceUrl: string | null;
}

async function sendFeedback(
  eventType: string,
  digestId: string,
  clusterId: string
) {
  try {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        digest_id: digestId,
        cluster_id: clusterId,
      }),
    });
  } catch {
    toast.error("Could not save feedback");
  }
}

export function StoryBlockActions({
  digestId,
  clusterId,
  sourceUrl,
}: StoryBlockActionsProps) {
  return (
    <div className="flex items-center gap-0.5">
      <ActionIcon
        icon={ThumbsUp}
        label="Like"
        onClick={() => sendFeedback("like", digestId, clusterId)}
      />
      <ActionIcon
        icon={Bookmark}
        label="Save"
        onClick={() => sendFeedback("save", digestId, clusterId)}
      />
      <ActionIcon
        icon={BellOff}
        label="Ignore topic"
        onClick={() => sendFeedback("ignore_topic", digestId, clusterId)}
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
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
