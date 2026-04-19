"use client";

import { useState } from "react";

export function ResetPreferencesButton({ userId }: { userId: string }) {
  const [state, setState] = useState<"idle" | "confirm" | "loading" | "done" | "error">("idle");

  async function handleReset() {
    setState("loading");
    try {
      const res = await fetch(`/api/admin/reset-preferences?user_id=${userId}`, {
        method: "DELETE",
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 3000);
  }

  if (state === "confirm") {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sure?</span>
        <button onClick={handleReset} className="text-xs text-destructive underline">Yes, reset</button>
        <button onClick={() => setState("idle")} className="text-xs text-muted-foreground underline">Cancel</button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setState("confirm")}
      disabled={state === "loading"}
      className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors disabled:opacity-50 text-destructive"
    >
      {state === "idle" && "Reset prefs"}
      {state === "loading" && "Resetting…"}
      {state === "done" && "✓ Reset"}
      {state === "error" && "✗ Failed"}
    </button>
  );
}
