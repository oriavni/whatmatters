import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { SourceAttribution } from "./SourceAttribution";
import { StoryBlockActions } from "./StoryBlockActions";
import type { BriefCluster } from "./types";

interface StoryBlockProps {
  cluster: BriefCluster;
  isLead?: boolean;
  digestId: string;
  initialLiked?: boolean;
  initialSaved?: boolean;
  initialIgnored?: boolean;
}

export function StoryBlock({
  cluster,
  isLead,
  digestId,
  initialLiked = false,
  initialSaved = false,
  initialIgnored = false,
}: StoryBlockProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={isLead ? "text-lg" : undefined}>
          {cluster.topic}
        </CardTitle>
        {cluster.summary && (
          <CardDescription className="text-sm leading-relaxed">
            {cluster.summary}
          </CardDescription>
        )}
        <CardAction>
          <StoryBlockActions
            digestId={digestId}
            clusterId={cluster.id}
            topicLabel={cluster.topic}
            sourceUrl={cluster.sourceUrl}
            initialLiked={initialLiked}
            initialSaved={initialSaved}
            initialIgnored={initialIgnored}
          />
        </CardAction>
      </CardHeader>

      {cluster.sources.length > 0 && (
        <CardContent className="pt-0">
          <SourceAttribution sources={cluster.sources} />
        </CardContent>
      )}
    </Card>
  );
}
