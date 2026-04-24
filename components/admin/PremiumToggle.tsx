"use client";

import { useState } from "react";

export function PremiumToggle({
  userId,
  isPremium,
}: {
  userId: string;
  isPremium: boolean;
}) {
  const [value, setValue] = useState(isPremium);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/premium-override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_premium_override: !value }),
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
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-muted text-muted-foreground border-border"
      }`}
    >
      {saving ? "Saving…" : value ? "✓ Premium (override)" : "Free — click to grant premium"}
    </button>
  );
}
