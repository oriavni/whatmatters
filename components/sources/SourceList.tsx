"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Rss,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Pause,
  Play,
  Pencil,
  Trash2,
  Check,
  Copy,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AddSourceDialog } from "@/components/sources/AddSourceDialog";

interface Source {
  id: string;
  name: string;
  url: string | null;
  type: "rss" | "newsletter" | "manual";
  status: "active" | "paused" | "error";
  created_at: string;
  last_fetched_at: string | null;
  error_message: string | null;
}

interface SourceListProps {
  refreshKey?: number;
  inboundAddress?: string;
  onRefresh?: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SourceList({ refreshKey = 0, inboundAddress, onRefresh }: SourceListProps) {
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

  function handleDeleted(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  function handleUpdated(id: string, updates: Partial<Source>) {
    setSources((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-4 shrink-0 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-destructive">{error}</div>
    );
  }

  if (sources.length === 0) {
    return <SourcesEmptyState inboundAddress={inboundAddress} onAdded={() => { load(); onRefresh?.(); }} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              onDeleted={() => handleDeleted(source.id)}
              onUpdated={(updates) => handleUpdated(source.id, updates)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SourceRow({
  source: init,
  onDeleted,
  onUpdated,
}: {
  source: Source;
  onDeleted: () => void;
  onUpdated: (updates: Partial<Source>) => void;
}) {
  const [source, setSource] = useState(init);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(init.name);
  const prevStatus = useRef(init.status);

  const Icon = source.type === "rss" ? Rss : Mail;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Request failed");
      }
    } finally {
      setBusy(false);
    }
  }

  function applyOptimistic(updates: Partial<Source>) {
    setSource((s) => ({ ...s, ...updates }));
    onUpdated(updates);
  }

  async function handlePauseResume() {
    const next: Source["status"] =
      source.status === "paused" ? "active" : "paused";
    prevStatus.current = source.status;
    applyOptimistic({ status: next });
    try {
      await patch({ status: next });
    } catch {
      applyOptimistic({ status: prevStatus.current });
      toast.error("Could not update source");
    }
  }

  async function handleRetry() {
    prevStatus.current = source.status;
    applyOptimistic({ status: "active", error_message: null });
    try {
      await patch({ action: "retry" });
      toast.success("Fetch queued — check back in a moment");
    } catch {
      applyOptimistic({ status: prevStatus.current });
      toast.error("Could not queue fetch");
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      onDeleted();
    } catch {
      toast.error("Could not delete source");
      setBusy(false);
    }
  }

  async function commitRename() {
    const trimmed = nameInput.trim();
    setRenaming(false);
    if (!trimmed || trimmed === source.name) return;
    const prev = source.name;
    applyOptimistic({ name: trimmed });
    try {
      await patch({ name: trimmed });
    } catch {
      applyOptimistic({ name: prev });
      setNameInput(prev);
      toast.error("Could not rename source");
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground mt-0.5 self-start" />

      <div className="min-w-0 flex-1">
        {renaming ? (
          <Input
            className="h-7 text-sm"
            value={nameInput}
            autoFocus
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setRenaming(false);
                setNameInput(source.name);
              }
            }}
          />
        ) : (
          <p className="text-sm font-medium truncate">{source.name}</p>
        )}
        {source.url && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {source.url}
          </p>
        )}
        {source.status === "error" && source.error_message ? (
          <p
            className="text-xs text-destructive truncate mt-0.5"
            title={source.error_message}
          >
            {source.error_message}
          </p>
        ) : source.last_fetched_at ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            Fetched {relativeTime(source.last_fetched_at)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">Never fetched</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {source.status === "paused" && (
          <Badge variant="secondary">Paused</Badge>
        )}
        {source.status === "error" && (
          <Badge variant="destructive">Error</Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={busy}
              aria-label="Source options"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleRetry}>
              <RefreshCw className="size-4" />
              Retry fetch
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePauseResume}>
              {source.status === "paused" ? (
                <>
                  <Play className="size-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="size-4" />
                  Pause
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setNameInput(source.name);
                setRenaming(true);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function InlineCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}

function SourcesEmptyState({
  inboundAddress,
  onAdded,
}: {
  inboundAddress?: string;
  onAdded?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card divide-y">
      {/* Path 1 — RSS feed */}
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Rss className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Add an RSS feed</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste a website URL and we&apos;ll find the RSS feed automatically.
        </p>
        <AddSourceDialog onAdded={onAdded}>
          <Button size="sm" variant="outline">Add RSS feed</Button>
        </AddSourceDialog>
      </div>

      {/* Path 2 — newsletter forwarding */}
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Bring your newsletters</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Subscribe to any newsletter using this address and it will arrive in
          your Brief automatically. For newsletters you already receive,
          set up forwarding from your email client.
        </p>
        <p className="text-xs text-muted-foreground">
          Some newsletters send a confirmation email when you subscribe with a
          new address — you may need to confirm it before issues start arriving.
        </p>
        {inboundAddress && (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded-md truncate">
              {inboundAddress}
            </code>
            <InlineCopyButton text={inboundAddress} />
          </div>
        )}
      </div>
    </div>
  );
}
