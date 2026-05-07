import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SourceAttribution } from "./SourceAttribution";
import { StoryBlockActions } from "./StoryBlockActions";
import type { BriefCluster } from "./types";

interface StoryBlockProps {
  cluster: BriefCluster;
  /** First two full-block clusters render at a larger title size */
  isLead?: boolean;
  digestId: string;
  initialLiked?: boolean;
  initialSaved?: boolean;
  initialIgnoreLevel?: 0 | 1 | 2 | 3;
}

export function StoryBlock({
  cluster,
  isLead,
  digestId,
  initialLiked = false,
  initialSaved = false,
  initialIgnoreLevel = 0,
}: StoryBlockProps) {
  const hasSources = cluster.sources.length > 0;

  return (
    <Card>
      <CardHeader>
        {/* shadcn CardTitle — no default font-size, set it per context */}
        <CardTitle className={isLead ? "text-lg" : "text-base"}>
          {cluster.topic}
        </CardTitle>

        {cluster.summary && (
          <CardDescription className="leading-relaxed">
            {cluster.summary}
          </CardDescription>
        )}

        {/* CardAction slots into col 2 of the CardHeader grid, spanning both rows */}
        <CardAction>
          <StoryBlockActions
            digestId={digestId}
            clusterId={cluster.id}
            topicLabel={cluster.topic}
            sourceUrl={cluster.sourceUrl}
            initialLiked={initialLiked}
            initialSaved={initialSaved}
            initialIgnoreLevel={initialIgnoreLevel}
          />
        </CardAction>
      </CardHeader>

      {hasSources && (
        <CardContent className="flex flex-col gap-4 pt-0">
          <Separator />
          <SourceAttribution sources={cluster.sources} />
        </CardContent>
      )}
    </Card>
  );
}
