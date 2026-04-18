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
  /** 0 = not ignored, 1-3 = suppressed for N upcoming digests */
  initialIgnoreLevel?: 0 | 1 | 2 | 3;
}

async function sendFeedback(
  eventType: string,
  digestId: string,
  clusterId: string,
  extra?: Record<string, string>
): Promise<{ ok: boolean; active?: boolean; suppress_level?: number }> {
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
    return { ok: true, active: data.active, suppress_level: data.suppress_level };
  } catch {
    toast.error("Could not save feedback");
    return { ok: false };
  }
}

// Inline style colors for the three ignore levels — bypasses Tailwind scanning.
const IGNORE_STYLES: Record<1 | 2 | 3, React.CSSProperties> = {
  1: { color: "hsl(38 92% 50%)" },  // amber  — "snooze 1"
  2: { color: "hsl(20 90% 52%)" },  // orange — "snooze 2"
  3: { color: "hsl(0 72% 51%)" },   // red    — "snooze 3"
};

const IGNORE_TOASTS: Record<0 | 1 | 2 | 3, string> = {
  0: "Topic un-ignored",
  1: "Ignoring similar items for the next digest",
  2: "Ignoring similar items for the next 2 digests",
  3: "Ignoring similar items for the next 3 digests",
};

const IGNORE_TOOLTIPS: Record<0 | 1 | 2 | 3, string> = {
  0: "Ignore topic",
  1: "Ignored for 1 digest — click to extend",
  2: "Ignored for 2 digests — click to extend",
  3: "Ignored for 3 digests — click to reset",
};

/**
 * Like    — toggle: like / unlike. Persisted to DB; no ranking effect yet.
 * Save    — toggle: save / unsave. Appears in Archive.
 * Ignore  — 4-state cycle (0 → 1 → 2 → 3 → 0): suppresses the topic from
 *           the next N digests. All clicks are stored for future ML.
 *
 * Initial state is passed from the parent which fetches /api/interactions on
 * page load, so state is correct on first render and after navigation.
 */
export function StoryBlockActions({
  digestId,
  clusterId,
  topicLabel,
  sourceUrl,
  initialLiked = false,
  initialSaved = false,
  initialIgnoreLevel = 0,
}: StoryBlockActionsProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [ignoreLevel, setIgnoreLevel] = useState<0 | 1 | 2 | 3>(initialIgnoreLevel);

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
    // Optimistic: cycle to next level locally
    const nextLevel = (ignoreLevel < 3 ? ignoreLevel + 1 : 0) as 0 | 1 | 2 | 3;
    setIgnoreLevel(nextLevel);

    const result = await sendFeedback("ignore_topic", digestId, clusterId, {
      topic_label: topicLabel,
    });

    if (!result.ok) {
      setIgnoreLevel(ignoreLevel); // rollback to previous
      return;
    }

    // Sync with server's actual level (server owns the cycle)
    const confirmedLevel = (result.suppress_level ?? nextLevel) as 0 | 1 | 2 | 3;
    setIgnoreLevel(confirmedLevel);
    toast.success(IGNORE_TOASTS[confirmedLevel]);
  }

  // Active style for like/save — foreground fill/stroke
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
      {/* Ignore: BellOff when any level is active, coloured by level */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
            />
          }
          onClick={handleIgnore}
        >
          {ignoreLevel > 0 ? (
            <BellOff
              className="size-3.5"
              style={IGNORE_STYLES[ignoreLevel as 1 | 2 | 3]}
            />
          ) : (
            <Bell className="size-3.5" />
          )}
        </TooltipTrigger>
        <TooltipContent>{IGNORE_TOOLTIPS[ignoreLevel]}</TooltipContent>
      </Tooltip>
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
