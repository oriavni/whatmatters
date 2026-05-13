"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Check, ExternalLink, Rss, Mail, Users, FileText, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DiscoverySource {
  id: string;
  name: string;
  url: string;
  feed_url: string | null;
  source_type: string;
  category: string;
  tags: string[];
  description: string;
  coolness_score: number;
  freshness_score: number;
  trust_score: number;
}

interface SourceDiscoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  /** Called after sources are successfully added */
  onSourcesAdded?: (count: number) => void;
}

function sourceTypeIcon(type: string) {
  switch (type) {
    case "rss":        return <Rss className="size-3" />;
    case "newsletter": return <Mail className="size-3" />;
    case "reddit":     return <Users className="size-3" />;
    case "blog":       return <FileText className="size-3" />;
    default:           return <Globe className="size-3" />;
  }
}

function sourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    rss: "RSS feed",
    newsletter: "Newsletter",
    reddit: "Reddit",
    blog: "Blog",
    report_site: "Reports",
    community: "Community",
    other: "Website",
  };
  return labels[type] ?? type;
}

function SourceCard({
  source,
  selected,
  onToggle,
  added,
}: {
  source: DiscoverySource;
  selected: boolean;
  onToggle: () => void;
  added: boolean;
}) {
  return (
    <button
      onClick={!added ? onToggle : undefined}
      disabled={added}
      className={cn(
        "w-full text-left rounded-lg border p-4 transition-colors",
        added
          ? "border-border bg-muted/40 cursor-default opacity-70"
          : selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-border/80 hover:bg-muted/30 cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{source.name}</span>
            <Badge variant="secondary" className="text-xs gap-1 px-1.5">
              {sourceTypeIcon(source.source_type)}
              {sourceTypeLabel(source.source_type)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {source.description}
          </p>
          {source.tags.slice(0, 3).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {source.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-muted-foreground/70 bg-muted/50 rounded px-1.5 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 mt-0.5">
          {added ? (
            <div className="size-5 rounded-full bg-muted flex items-center justify-center">
              <Check className="size-3 text-muted-foreground" />
            </div>
          ) : (
            <div
              className={cn(
                "size-5 rounded-full border-2 flex items-center justify-center transition-colors",
                selected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30",
              )}
            >
              {selected && <Check className="size-3 text-primary-foreground" />}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function SourceDiscoveryModal({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  onSourcesAdded,
}: SourceDiscoveryModalProps) {
  const [sources, setSources] = useState<DiscoverySource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const fetchSources = useCallback(async () => {
    setIsLoading(true);
    setSources([]);
    setSelected(new Set());
    try {
      const res = await fetch(
        `/api/discover/sources?category=${encodeURIComponent(categoryId)}`
      );
      if (!res.ok) throw new Error("Failed to load sources");
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch {
      toast.error("Could not load source recommendations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    if (open) {
      setAdded(new Set());
      fetchSources();
    }
  }, [open, fetchSources]);

  function toggleSource(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    const toAdd = sources.filter((s) => selected.has(s.id) && s.feed_url);
    if (!toAdd.length) return;

    setIsAdding(true);
    let successCount = 0;

    await Promise.all(
      toAdd.map(async (source) => {
        try {
          const res = await fetch("/api/sources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add",
              feed_url: source.feed_url,
              feed_title: source.name,
            }),
          });
          if (res.ok || res.status === 409) {
            // 409 = already exists, still count as "done"
            successCount++;
            setAdded((prev) => new Set(prev).add(source.id));
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(source.id);
              return next;
            });
          }
        } catch {
          // individual failure — continue with others
        }
      })
    );

    setIsAdding(false);

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Source added to your feed."
          : `${successCount} sources added to your feed.`
      );
      onSourcesAdded?.(successCount);
    }
  }

  const selectableSelected = [...selected].filter(
    (id) => sources.find((s) => s.id === id)?.feed_url
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-base">{categoryName}</SheetTitle>
          <SheetDescription className="text-sm">
            Select sources to add to your feed. They&apos;ll be picked up in your next Brief.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && sources.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No new sources found for this category.
            </p>
          )}

          {!isLoading &&
            sources.map((source) => (
              <SourceCard
                key={source.id}
                source={source}
                selected={selected.has(source.id)}
                added={added.has(source.id)}
                onToggle={() => toggleSource(source.id)}
              />
            ))}
        </div>

        {!isLoading && sources.length > 0 && (
          <div className="px-6 py-4 border-t space-y-2">
            <Button
              className="w-full"
              disabled={selectableSelected.length === 0 || isAdding}
              onClick={handleAdd}
            >
              {isAdding ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Adding…
                </>
              ) : selectableSelected.length === 0 ? (
                "Select sources to add"
              ) : (
                `Add ${selectableSelected.length} source${selectableSelected.length > 1 ? "s" : ""}`
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Sources without an RSS feed can be added manually from the{" "}
              <a href="/app/sources" className="underline underline-offset-2">
                Sources page
              </a>
              .
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
