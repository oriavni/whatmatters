"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { SourceAttribution } from "./SourceAttribution";
import { StoryBlockActions } from "./StoryBlockActions";
import type { BriefCluster } from "./types";

interface StoryBlockProps {
  cluster: BriefCluster;
  isLead?: boolean;
}

export function StoryBlock({ cluster, isLead }: StoryBlockProps) {
  const [actionsVisible, setActionsVisible] = useState(false);

  return (
    <article
      className="group py-8 first:pt-0 last:[&>hr]:hidden"
      onMouseEnter={() => setActionsVisible(true)}
      onMouseLeave={() => setActionsVisible(false)}
      onFocus={() => setActionsVisible(true)}
      onBlur={() => setActionsVisible(false)}
    >
      <h2
        className={
          isLead
            ? "text-[1.0625rem] font-semibold leading-snug tracking-tight mb-3"
            : "text-base font-semibold leading-snug tracking-tight mb-3"
        }
      >
        {cluster.topic}
      </h2>

      {cluster.summary && (
        <p className="text-sm leading-[1.75] text-foreground/80 mb-4">
          {cluster.summary}
        </p>
      )}

      {/* Attribution and action bar on the same row */}
      <div className="flex items-center justify-between gap-4 min-h-[28px]">
        <SourceAttribution sources={cluster.sources} />
        <StoryBlockActions
          clusterId={cluster.id}
          sourceUrl={cluster.sourceUrl}
          visible={actionsVisible}
          className="shrink-0"
        />
      </div>

      <Separator className="mt-8" />
    </article>
  );
}
