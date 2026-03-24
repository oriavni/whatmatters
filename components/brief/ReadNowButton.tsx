"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

interface ReadNowButtonProps {
  onGenerate?: () => void;
}

export function ReadNowButton({ onGenerate }: ReadNowButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleReadNow() {
    setLoading(true);
    try {
      const res = await fetch("/api/brief/generate", { method: "POST" });

      if (res.status === 409) {
        toast.info("Your Brief is already being generated. Check back in a moment.");
        onGenerate?.();
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to generate Brief");
      }

      toast.success("Generating your Brief — it will appear here shortly.");
      onGenerate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate Brief");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReadNow}
      disabled={loading}
      className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Zap className="size-3" />
      )}
      {loading ? "Generating…" : "Read now"}
    </Button>
  );
}
