"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Suppression {
  topic: string;
  suppress_level: number;
  digests_remaining: number;
}

interface IgnoredTopicsListProps {
  initialSuppressions: Suppression[];
}

export function IgnoredTopicsList({ initialSuppressions }: IgnoredTopicsListProps) {
  const [suppressions, setSuppressions] = useState(initialSuppressions);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(topic: string) {
    setRemoving(topic);
    try {
      const res = await fetch(
        `/api/topic-suppressions?topic=${encodeURIComponent(topic)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      setSuppressions((prev) => prev.filter((s) => s.topic !== topic));
      toast.success(`"${topic}" will appear in future digests`);
    } catch {
      toast.error("Could not remove — please try again");
    } finally {
      setRemoving(null);
    }
  }

  if (suppressions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No topics are currently ignored. Use the ignore button on any story to suppress it temporarily.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {suppressions.map((s) => (
        <li
          key={s.topic}
          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{s.topic}</p>
            <p className="text-xs text-muted-foreground">
              {s.digests_remaining === 1
                ? "Suppressed for 1 more digest"
                : `Suppressed for ${s.digests_remaining} more digests`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => handleRemove(s.topic)}
            disabled={removing === s.topic}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
