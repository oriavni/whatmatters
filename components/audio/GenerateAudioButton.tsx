"use client";

/**
 * GenerateAudioButton
 *
 * Idempotent: checks the current audio status via GET before initiating a new
 * generation job, so repeated or parallel clicks never leave the player in an
 * inconsistent state.
 *
 * Click flow:
 *   1. GET /api/audio/[digestId] — check existing status
 *   2. "completed" | "pending" | "generating"  → navigate directly to player
 *   3. "not_found"                              → POST to generate, then navigate
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioStatusResponse {
  status: "completed" | "pending" | "generating" | "not_found" | "failed";
}

export function GenerateAudioButton({
  digestId,
  label = "🎧 Generate",
}: {
  digestId: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    try {
      // ── Step 1: Check current status ────────────────────────────
      const statusRes = await fetch(`/api/audio/${digestId}`);
      if (!statusRes.ok) {
        alert("Could not check audio status. Please try again.");
        return;
      }
      const statusData: AudioStatusResponse = await statusRes.json();

      // ── Step 2: Navigate directly if audio already exists ────────
      if (
        statusData.status === "completed" ||
        statusData.status === "pending" ||
        statusData.status === "generating"
      ) {
        router.push(`/app/audio-briefs/${digestId}`);
        return;
      }

      // ── Step 3: Initiate generation for "not_found" (or "failed") ─
      const genRes = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_id: digestId }),
      });
      const genData = await genRes.json();

      if (genRes.ok) {
        router.push(`/app/audio-briefs/${digestId}`);
      } else {
        alert(genData.error ?? "Failed to start generation");
        setLoading(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Starting…
        </>
      ) : (
        label
      )}
    </Button>
  );
}
