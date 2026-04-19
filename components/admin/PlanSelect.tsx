"use client";

import { useState } from "react";

const PLANS = ["free", "pro", "lifetime"] as const;
type Plan = typeof PLANS[number];

export function PlanSelect({ userId, currentPlan }: { userId: string; currentPlan: Plan }) {
  const [plan, setPlan] = useState<Plan>(currentPlan);
  const [saving, setSaving] = useState(false);

  async function handleChange(newPlan: Plan) {
    if (newPlan === plan) return;
    setSaving(true);
    try {
      await fetch("/api/admin/plan-override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, plan: newPlan }),
      });
      setPlan(newPlan);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={plan}
      onChange={(e) => handleChange(e.target.value as Plan)}
      disabled={saving}
      className="text-xs px-2 py-1 rounded border border-border bg-background disabled:opacity-50"
    >
      {PLANS.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}
