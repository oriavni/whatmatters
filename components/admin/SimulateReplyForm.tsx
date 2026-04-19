"use client";

import { useState } from "react";

export function SimulateReplyForm({ userId }: { userId: string }) {
  const [command, setCommand] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/simulate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, command }),
      });
      if (res.ok) {
        setState("done");
        setCommand("");
      } else {
        const data = await res.json();
        setErrorMsg(data.error ?? "Failed");
        setState("error");
      }
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder='e.g. "ignore AI" or "daily"'
        className="flex-1 px-3 py-1.5 text-xs border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={state === "loading" || !command.trim()}
        className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {state === "loading" ? "Running…" : state === "done" ? "✓ Sent" : state === "error" ? "✗ Error" : "Simulate"}
      </button>
      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
    </form>
  );
}
