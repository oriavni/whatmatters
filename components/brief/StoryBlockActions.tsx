"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  ThumbsUp,
  Bookmark,
  BookmarkCheck,
  BellOff,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface StoryBlockActionsProps {
  digestId: string;
  clusterId: string;
  topicLabel: string;
  sourceUrl: string | null;
}

async function sendFeedback(
  eventType: string,
  digestId: string,
  clusterId: string,
  extra?: Record<string, string>
): Promise<boolean> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        digest_id: digestId,
        cluster_id: clusterId,
        ...extra,
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
 * Like    — one-way signal (un-like not supported yet)
 * Save    — toggleable: click to save, click again to unsave
 * Ignore  — one-way (strongest signal, should not be toggled off accidentally)
 *
 * Active state uses inline style with CSS variables so it is guaranteed to
 * reach the SVG element regardless of Tailwind scan / className merge chain.
 */
export function StoryBlockActions({
  digestId,
  clusterId,
  topicLabel,
  sourceUrl,
}: StoryBlockActionsProps) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ignored, setIgnored] = useState(false);

  async function handleLike() {
    if (liked) return;
    setLiked(true);
    const ok = await sendFeedback("like", digestId, clusterId);
    if (!ok) setLiked(false);
  }

  async function handleSave() {
    if (saved) {
      // Unsave — optimistic
      setSaved(false);
      const res = await fetch(
        `/api/saved?cluster_id=${encodeURIComponent(clusterId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setSaved(true); // rollback
        toast.error("Could not remove from saved");
      }
      return;
    }
    // Save — optimistic
    setSaved(true);
    const ok = await sendFeedback("save", digestId, clusterId);
    if (!ok) setSaved(false);
  }

  async function handleIgnore() {
    if (ignored) return;
    setIgnored(true);
    const ok = await sendFeedback("ignore_topic", digestId, clusterId, {
      topic_label: topicLabel,
    });
    if (!ok) {
      setIgnored(false);
    } else {
      toast.success("Topic ignored — we'll show it less often");
    }
  }

  // Active icon color: inline CSS variable so it bypasses Tailwind scanning
  // and the cloneElement/mergeProps chain in TooltipTrigger.
  const activeStyle = { color: "var(--color-foreground)" } as const;

  return (
    <div className="flex items-center gap-0.5">
      <ActionIcon
        icon={ThumbsUp}
        label={liked ? "Liked" : "Like"}
        active={liked}
        activeStyle={activeStyle}
        onClick={handleLike}
      />
      <ActionIcon
        icon={Bookmark}
        activeIcon={BookmarkCheck}
        label={saved ? "Remove from saved" : "Save"}
        active={saved}
        activeStyle={activeStyle}
        onClick={handleSave}
      />
      <ActionIcon
        icon={BellOff}
        label={ignored ? "Topic ignored" : "Ignore topic"}
        active={ignored}
        activeStyle={activeStyle}
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
  activeIcon: ActiveIcon,
  label,
  active,
  activeStyle,
  onClick,
}: {
  icon: React.ElementType;
  activeIcon?: React.ElementType;
  label: string;
  active: boolean;
  activeStyle: React.CSSProperties;
  onClick: () => void;
}) {
  const DisplayIcon = active && ActiveIcon ? ActiveIcon : Icon;

  return (
    <Tooltip>
      {/*
       * onClick on TooltipTrigger so it lands in elementProps and merges
       * cleanly — placing it in render={<Button onClick>} requires surviving
       * cloneElement + mergeProps which is unreliable.
       */}
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
          />
        }
        onClick={onClick}
      >
        {/*
         * Active color applied via inline style, not Tailwind class.
         * Tailwind may not scan dynamically-constructed class strings;
         * inline style with a CSS variable is guaranteed to reach the SVG.
         */}
        <DisplayIcon
          className="size-3.5"
          style={active ? activeStyle : undefined}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
