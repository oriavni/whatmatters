"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";

interface SavedCluster {
  id: string;
  created_at: string;
  cluster_id: string;
  topic_clusters: {
    topic: string;
    summary: string | null;
  } | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function SavedList() {
  const [items, setItems] = useState<SavedCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/saved");
      if (!res.ok) throw new Error("Failed to load saved items");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      toast.error("Could not load saved items");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRemove(id: string) {
    // Optimistic removal
    setItems((prev) => prev.filter((item) => item.id !== id));

    const res = await fetch(`/api/saved?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove saved item");
      load(); // reload to restore correct state
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nothing saved yet. Click the bookmark icon on any Brief story to save it here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const cluster = item.topic_clusters;
        if (!cluster) return null;
        return (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-base">{cluster.topic}</CardTitle>
              {cluster.summary && (
                <CardDescription className="text-sm leading-relaxed">
                  {cluster.summary}
                </CardDescription>
              )}
              <CardAction>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(item.created_at)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(item.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardAction>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
