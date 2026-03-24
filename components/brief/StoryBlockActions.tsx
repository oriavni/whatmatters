"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ThumbsUp, Bookmark, Pin, BellOff, ExternalLink } from "lucide-react";

interface StoryBlockActionsProps {
  clusterId: string;
  sourceUrl: string | null;
  visible: boolean;
  className?: string;
}

export function StoryBlockActions({
  clusterId: _clusterId,
  sourceUrl,
  visible,
  className,
}: StoryBlockActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
        className
      )}
    >
      <ActionIcon icon={ThumbsUp} label="Like" />
      <ActionIcon icon={Bookmark} label="Save" />
      <ActionIcon icon={Pin} label="Pin" disabled />
      <ActionIcon icon={BellOff} label="Ignore topic" />
      {sourceUrl && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
              />
            }
          >
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center size-full">
              <ExternalLink className="size-3.5" />
            </a>
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
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          />
        }
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
