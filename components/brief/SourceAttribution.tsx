import { cn } from "@/lib/utils";
import type { BriefSource } from "./types";

interface SourceAttributionProps {
  sources: BriefSource[];
  className?: string;
}

export function SourceAttribution({ sources, className }: SourceAttributionProps) {
  if (sources.length === 0) return null;

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {sources.map((s) => s.name).join(" · ")}
    </p>
  );
}
