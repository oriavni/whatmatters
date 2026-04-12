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
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface StoryBlockActionsProps {
  digestId: string;
  clusterId: string;
  topicLabel: string;
  sourceUrl: string | null;
  initialLiked?: boolean;
  initialSaved?: boolean;
  initialIgnored?: boolean;
}

async function sendFeedback(
  eventType: string,
  digestId: string,
  clusterId: string,
  extra?: Record<string, string>
): Promise<{ ok: boolean; active?: boolean }> {
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
      return { ok: false };
    }
    const data = await res.json();
    return { ok: true, active: data.active };
  } catch {
    toast.error("Could not save feedback");
    return { ok: false };
  }
}

/**
 * Like    — toggle: first click = like, second click = unlike
 * Save    — toggle: click to save, click again to unsave
 * Ignore  — toggle: first click = ignore topic (BellOff), second click = un-ignore (Bell)
 *
 * Initial state (liked/saved/ignored) is passed from the parent which fetches
 * it from /api/interactions on page load — so state is correct on first render,
 * after refresh, and after navigating away and back.
 *
 * Active state uses inline style with CSS variables so it is guaranteed to
 * reach the SVG element regardless of Tailwind scan / className merge chain.
 */
export function StoryBlockActions({
  digestId,
  clusterId,
  topicLabel,
  sourceUrl,
  initialLiked = false,
  initialSaved = false,
  initialIgnored = false,
}: StoryBlockActionsProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [ignored, setIgnored] = useState(initialIgnored);

  async function handleLike() {
    const next = !liked;
    setLiked(next); // optimistic
    const result = await sendFeedback("like", digestId, clusterId);
    if (!result.ok) {
      setLiked(!next); // rollback
    } else if (result.active !== undefined) {
      setLiked(result.active); // sync with server truth
    }
  }

  async function handleSave() {
    if (saved) {
      setSaved(false); // optimistic
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
    setSaved(true); // optimistic
    const result = await sendFeedback("save", digestId, clusterId);
    if (!result.ok) setSaved(false);
  }

  async function handleIgnore() {
    const next = !ignored;
    setIgnored(next); // optimistic
    const result = await sendFeedback("ignore_topic", digestId, clusterId, {
      topic_label: topicLabel,
    });
    if (!result.ok) {
      setIgnored(!next); // rollback
    } else {
      const isNowIgnored = result.active !== undefined ? result.active : next;
      setIgnored(isNowIgnored);
      if (isNowIgnored) {
        toast.success("Topic ignored — we'll show it less often");
      } else {
        toast.success("Topic un-ignored");
      }
    }
  }

  // Active color via inline CSS variable — bypasses Tailwind scanning and
  // the cloneElement/mergeProps chain in TooltipTrigger.
  // Like gets fill too so filled-vs-outline is unambiguous (no icon swap available).
  const activeStyle = { color: "var(--color-foreground)" } as const;
  const activeFilledStyle = { color: "var(--color-foreground)", fill: "var(--color-foreground)" } as const;

  return (
    <div className="flex items-center gap-0.5">
      <ActionIcon
        icon={ThumbsUp}
        label={liked ? "Unlike" : "Like"}
        active={liked}
        activeStyle={activeFilledStyle}
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
        icon={Bell}
        activeIcon={BellOff}
        label={ignored ? "Un-ignore topic" : "Ignore topic"}
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
        <DisplayIcon
          className="size-3.5"
          style={active ? activeStyle : undefined}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
