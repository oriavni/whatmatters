"use client";

import { useState } from "react";

export function ForceGenerateButton({ userId }: { userId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/force-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 3000);
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
    >
      {state === "idle" && "Generate"}
      {state === "loading" && "Queuing…"}
      {state === "done" && "✓ Queued"}
      {state === "error" && "✗ Failed"}
    </button>
  );
}
