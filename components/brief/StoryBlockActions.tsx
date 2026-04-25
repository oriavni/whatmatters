"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ThumbsUp,
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  MoreHorizontal,
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

// Inline style colors for the three ignore levels
const IGNORE_STYLES: Record<1 | 2 | 3, React.CSSProperties> = {
  1: { color: "hsl(38 92% 50%)" },  // amber
  2: { color: "hsl(20 90% 52%)" },  // orange
  3: { color: "hsl(0 72% 51%)" },   // red
};

const IGNORE_TOASTS: Record<0 | 1 | 2 | 3, string> = {
  0: "Topic un-ignored",
  1: "Ignoring similar items for the next digest",
  2: "Ignoring similar items for the next 2 digests",
  3: "Ignoring similar items for the next 3 digests",
};

const IGNORE_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "Ignore topic",
  1: "Ignored (1 digest) — extend",
  2: "Ignored (2 digests) — extend",
  3: "Ignored (3 digests) — reset",
};

/**
 * Story card actions as a DropdownMenu triggered by an ellipsis button.
 * Like / Save / Ignore / Read original — all persisted to DB.
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
    setLiked(next);
    const result = await sendFeedback("like", digestId, clusterId);
    if (!result.ok) {
      setLiked(!next);
    } else if (result.active !== undefined) {
      setLiked(result.active);
    }
  }

  async function handleSave() {
    if (saved) {
      setSaved(false);
      const res = await fetch(
        `/api/saved?cluster_id=${encodeURIComponent(clusterId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setSaved(true);
        toast.error("Could not remove from saved");
      }
      return;
    }
    setSaved(true);
    const result = await sendFeedback("save", digestId, clusterId);
    if (!result.ok) setSaved(false);
  }

  async function handleIgnore() {
    const nextLevel = (ignoreLevel < 3 ? ignoreLevel + 1 : 0) as 0 | 1 | 2 | 3;
    setIgnoreLevel(nextLevel);

    const result = await sendFeedback("ignore_topic", digestId, clusterId, {
      topic_label: topicLabel,
    });

    if (!result.ok) {
      setIgnoreLevel(ignoreLevel);
      return;
    }

    const confirmedLevel = (result.suppress_level ?? nextLevel) as 0 | 1 | 2 | 3;
    setIgnoreLevel(confirmedLevel);
    toast.success(IGNORE_TOASTS[confirmedLevel]);
  }

  const activeStyle = { color: "var(--color-foreground)" } as const;
  const activeFilledStyle = { color: "var(--color-foreground)", fill: "var(--color-foreground)" } as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
          />
        }
        aria-label="More actions"
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-44">
        {/* Like */}
        <DropdownMenuItem onClick={handleLike}>
          {liked ? (
            <ThumbsUp className="size-3.5" style={activeFilledStyle} />
          ) : (
            <ThumbsUp className="size-3.5" />
          )}
          <span style={liked ? activeStyle : undefined}>
            {liked ? "Unlike" : "Like"}
          </span>
        </DropdownMenuItem>

        {/* Save */}
        <DropdownMenuItem onClick={handleSave}>
          {saved ? (
            <BookmarkCheck className="size-3.5" style={activeStyle} />
          ) : (
            <Bookmark className="size-3.5" />
          )}
          <span style={saved ? activeStyle : undefined}>
            {saved ? "Unsave" : "Save"}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Ignore */}
        <DropdownMenuItem onClick={handleIgnore}>
          {ignoreLevel > 0 ? (
            <BellOff className="size-3.5" style={IGNORE_STYLES[ignoreLevel as 1 | 2 | 3]} />
          ) : (
            <Bell className="size-3.5" />
          )}
          <span style={ignoreLevel > 0 ? IGNORE_STYLES[ignoreLevel as 1 | 2 | 3] : undefined}>
            {IGNORE_LABELS[ignoreLevel]}
          </span>
        </DropdownMenuItem>

        {/* Read original — only if sourceUrl exists */}
        {sourceUrl && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink className="size-3.5" />
              Read original
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
