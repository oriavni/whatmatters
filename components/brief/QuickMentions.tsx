import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
import type { BriefCluster } from "./types";

interface QuickMentionsProps {
  clusters: BriefCluster[];
}

export function QuickMentions({ clusters }: QuickMentionsProps) {
  if (clusters.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Also this edition
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {clusters.map((cluster) => (
            <MentionItem key={cluster.id} cluster={cluster} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MentionItem({ cluster }: { cluster: BriefCluster }) {
  const sourceNames = cluster.sources.map((s) => s.name).join(", ");

  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="size-1 rounded-full bg-border shrink-0 mt-2" />
      <p className="min-w-0 leading-snug">
        <span className="font-medium text-foreground">{cluster.topic}</span>
        {cluster.summary && (
          <span className="text-muted-foreground"> — {cluster.summary}</span>
        )}
        {sourceNames && (
          <span className="text-muted-foreground"> · {sourceNames}</span>
        )}
      </p>
    </li>
  );
}
