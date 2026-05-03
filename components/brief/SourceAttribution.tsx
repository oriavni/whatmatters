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
      {sources.map((s, i) => (
        <span key={s.id}>
          {i > 0 && " · "}
          {s.url?.startsWith("http") ? (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {s.name}
            </a>
          ) : (
            s.name
          )}
        </span>
      ))}
    </p>
  );
}
