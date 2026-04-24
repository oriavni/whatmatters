"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_id: digestId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Navigate to the player page — it will poll until done
        router.push(`/app/audio-briefs/${digestId}`);
      } else {
        alert(data.error ?? "Failed to start generation");
        setLoading(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm px-3 py-1.5 rounded-md border border-border text-foreground font-medium disabled:opacity-50 flex items-center gap-1.5"
    >
      {loading ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Starting…
        </>
      ) : (
        label
      )}
    </button>
  );
}
