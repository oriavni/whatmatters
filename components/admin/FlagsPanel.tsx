"use client";

import { useState } from "react";

interface Flag {
  key: string;
  value: boolean;
  description: string | null;
}

const WIRED_FLAGS = new Set(["replies_disabled"]);

export function FlagsPanel({ initialFlags }: { initialFlags: Flag[] }) {
  const [flags, setFlags] = useState(initialFlags);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleToggle(key: string, newValue: boolean) {
    setSaving(key);
    try {
      await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: newValue }),
      });
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, value: newValue } : f))
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3">
      {flags.map((flag) => {
        const isWired = WIRED_FLAGS.has(flag.key);
        return (
          <div
            key={flag.key}
            className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 ${
              flag.value ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : ""
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono font-medium">{flag.key}</p>
                {isWired ? (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                    wired
                  </span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    UI only
                  </span>
                )}
              </div>
              {flag.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
              )}
            </div>
            <button
              onClick={() => handleToggle(flag.key, !flag.value)}
              disabled={saving === flag.key}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                flag.value ? "bg-amber-500" : "bg-muted-foreground/30"
              }`}
              role="switch"
              aria-checked={flag.value}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform ${
                  flag.value ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
