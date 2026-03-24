import { Separator } from "@/components/ui/separator";
import type { BriefCluster } from "./types";

interface QuickMentionsProps {
  clusters: BriefCluster[];
}

export function QuickMentions({ clusters }: QuickMentionsProps) {
  if (clusters.length === 0) return null;

  return (
    <section>
      <Separator className="mb-8" />
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60 mb-5">
        Also this edition
      </p>
      <ul className="space-y-3.5">
        {clusters.map((cluster) => (
          <MentionItem key={cluster.id} cluster={cluster} />
        ))}
      </ul>
    </section>
  );
}

function MentionItem({ cluster }: { cluster: BriefCluster }) {
  const sourceNames = cluster.sources.map((s) => s.name).join(", ");

  return (
    <li className="flex items-baseline gap-2.5 text-sm">
      <span className="size-1 rounded-full bg-muted-foreground/30 shrink-0 mt-[7px]" />
      <p className="min-w-0 leading-snug">
        <span className="font-medium text-foreground/90">{cluster.topic}</span>
        {cluster.summary && (
          <span className="text-foreground/60"> — {cluster.summary}</span>
        )}
        {sourceNames && (
          <span className="text-muted-foreground/50"> · {sourceNames}</span>
        )}
      </p>
    </li>
  );
}
