import { cn } from "@/lib/utils";
import type { BriefSource } from "./types";

interface SourceAttributionProps {
  sources: BriefSource[];
  className?: string;
}

/**
 * Renders source attribution for a digest cluster.
 *
 * One source  → "Source: The Verge"
 * Multiple    → "Mentioned by 3 sources: Bloomberg, The Verge, Stratechery"
 *
 * Source names are clickable links when a URL is available.
 * No duplicate names — the API deduplicates by source ID before this renders.
 */
export function SourceAttribution({ sources, className }: SourceAttributionProps) {
  if (sources.length === 0) return null;

  const prefix =
    sources.length === 1
      ? "Source: "
      : `Mentioned by ${sources.length} sources: `;

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {prefix}
      {sources.map((s, i) => (
        <span key={s.id}>
          {i > 0 && ", "}
          {s.url ? (
            <a
              href={s.url.startsWith("http") ? s.url : `mailto:${s.url}`}
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
