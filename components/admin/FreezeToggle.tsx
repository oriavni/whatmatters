"use client";

import { useState } from "react";

export function FreezeToggle({
  userId,
  isFrozen,
}: {
  userId: string;
  isFrozen: boolean;
}) {
  const [value, setValue] = useState(isFrozen);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/freeze", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_frozen: !value }),
      });
      if (res.ok) setValue((v) => !v);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={saving}
      className={`text-xs px-3 py-1 rounded-full font-medium border transition-colors disabled:opacity-50 ${
        value
          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
          : "bg-muted text-muted-foreground border-border"
      }`}
    >
      {saving ? "Saving…" : value ? "🔒 Frozen — click to unfreeze" : "Freeze account"}
    </button>
  );
}
