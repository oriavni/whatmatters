"use client";

import { useCallback, useEffect, useState } from "react";
import { Rss, Mail, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Source {
  id: string;
  name: string;
  url: string | null;
  type: "rss" | "newsletter" | "manual";
  status: "active" | "paused" | "error";
  created_at: string;
}

interface SourceListProps {
  /** Increment to trigger a refresh from outside */
  refreshKey?: number;
}

export function SourceList({ refreshKey = 0 }: SourceListProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sources");
      if (!res.ok) throw new Error("Failed to load sources");
      const data = (await res.json()) as { sources: Source[] };
      setSources(data.sources ?? []);
    } catch {
      setError("Could not load sources. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading sources…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-destructive">{error}</div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No sources yet. Add a newsletter or RSS feed to get started.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {sources.map((source) => (
            <SourceRow key={source.id} source={source} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SourceRow({ source }: { source: Source }) {
  const Icon = source.type === "rss" ? Rss : Mail;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{source.name}</p>
        {source.url && (
          <p className="text-xs text-muted-foreground truncate">{source.url}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {source.status === "error" && (
          <AlertCircle className="size-3.5 text-destructive" />
        )}
        {source.status !== "active" && (
          <Badge variant="secondary" className="text-xs">
            {source.status}
          </Badge>
        )}
      </div>
    </li>
  );
}
