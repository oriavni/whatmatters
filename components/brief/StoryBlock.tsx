import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from "@/components/ui/card";
import { SourceAttribution } from "./SourceAttribution";
import { StoryBlockActions } from "./StoryBlockActions";
import type { BriefCluster } from "./types";

interface StoryBlockProps {
  cluster: BriefCluster;
  isLead?: boolean;
}

export function StoryBlock({ cluster, isLead }: StoryBlockProps) {
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
            clusterId={cluster.id}
            sourceUrl={cluster.sourceUrl}
          />
        </CardAction>
      </CardHeader>

      {cluster.sources.length > 0 && (
        <CardFooter>
          <SourceAttribution sources={cluster.sources} />
        </CardFooter>
      )}
    </Card>
  );
}
