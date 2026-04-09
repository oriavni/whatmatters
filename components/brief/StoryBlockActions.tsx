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

/**
 * Like / Save / Ignore are all ONE-WAY (no toggle-back).
 *
 * Like   — reading signal; un-liking is not meaningful at this stage.
 * Save   — a commitment; un-save requires a dedicated delete flow.
 * Ignore — strongest signal; should never be accidentally toggled off.
 *
 * State is session-local (useState). It resets on page refresh because the
 * backend does not yet expose a GET endpoint for feedback events. Once that
 * exists, initial state can be seeded from the server.
 */
export function StoryBlockActions({
  digestId,
  clusterId,
  sourceUrl,
}: StoryBlockActionsProps) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ignored, setIgnored] = useState(false);

  async function handleLike() {
    if (liked) return;
    setLiked(true); // optimistic — show immediately
    const ok = await sendFeedback("like", digestId, clusterId);
    if (!ok) setLiked(false); // rollback on failure
  }

  async function handleSave() {
    if (saved) return;
    setSaved(true);
    const ok = await sendFeedback("save", digestId, clusterId);
    if (!ok) setSaved(false);
  }

  async function handleIgnore() {
    if (ignored) return;
    setIgnored(true);
    const ok = await sendFeedback("ignore_topic", digestId, clusterId);
    if (!ok) {
      setIgnored(false);
    } else {
      toast.success("Topic ignored — we'll show it less often");
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      <ActionIcon
        icon={ThumbsUp}
        label={liked ? "Liked" : "Like"}
        active={liked}
        onClick={handleLike}
      />
      <ActionIcon
        icon={Bookmark}
        label={saved ? "Saved" : "Save"}
        active={saved}
        onClick={handleSave}
      />
      <ActionIcon
        icon={BellOff}
        label={ignored ? "Topic ignored" : "Ignore topic"}
        active={ignored}
        onClick={handleIgnore}
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
       * onClick on TooltipTrigger (not inside render={}) so it lands in
       * elementProps and is always merged cleanly by Base UI's useRenderElement.
       */}
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "transition-colors",
              active
                // Filled background + contrasting icon — clearly "on"
                ? "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground cursor-default"
                : "text-muted-foreground hover:text-foreground"
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
