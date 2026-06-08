"use client";

import { useState } from "react";

interface Coupon {
  id: string;
  code: string;
  plan_granted: "free" | "pro" | "premium";
  access_type: "discount" | "free";
  discount_percent: number | null;
  max_redemptions: number | null;
  redemptions_count: number;
  expires_at: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const emptyForm = {
  code: "",
  plan_granted: "pro" as "pro" | "premium",
  access_type: "free" as "discount" | "free",
  discount_percent: "",
  max_redemptions: "",
  expires_at: "",
  note: "",
};

export function CouponsPanel({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/coupons");
    if (res.ok) {
      const data = await res.json();
      setCoupons(data.coupons ?? []);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          plan_granted: form.plan_granted,
          access_type: form.access_type,
          discount_percent: form.access_type === "discount" && form.discount_percent
            ? Number(form.discount_percent)
            : null,
          max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
          note: form.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create coupon");
        return;
      }
      setForm(emptyForm);
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(coupon: Coupon) {
    setBusyId(coupon.id);
    try {
      await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: coupon.id, is_active: !coupon.is_active }),
      });
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    setBusyId(coupon.id);
    try {
      await fetch(`/api/admin/coupons?id=${coupon.id}`, { method: "DELETE" });
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Create form ── */}
      <form onSubmit={handleCreate} className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Create a coupon</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Code</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="FOUNDER30"
              className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background font-mono"
            />
          </label>

          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Plan granted</span>
            <select
              value={form.plan_granted}
              onChange={(e) => setForm((f) => ({ ...f, plan_granted: e.target.value as "pro" | "premium" }))}
              className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background"
            >
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </label>

          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Type</span>
            <select
              value={form.access_type}
              onChange={(e) => setForm((f) => ({ ...f, access_type: e.target.value as "discount" | "free" }))}
              className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background"
            >
              <option value="free">Free access (comp)</option>
              <option value="discount">Discount %</option>
            </select>
          </label>

          {form.access_type === "discount" && (
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Discount %</span>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={form.discount_percent}
                onChange={(e) => setForm((f) => ({ ...f, discount_percent: e.target.value }))}
                placeholder="30"
                className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background"
              />
            </label>
          )}

          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Max redemptions</span>
            <input
              type="number"
              min={1}
              value={form.max_redemptions}
              onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value }))}
              placeholder="Unlimited"
              className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background"
            />
          </label>

          <label className="text-xs space-y-1">
            <span className="text-muted-foreground">Expires</span>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background"
            />
          </label>

          <label className="text-xs space-y-1 col-span-2 sm:col-span-3">
            <span className="text-muted-foreground">Note (internal — who/why)</span>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Beta tester batch, June 2026"
              className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background"
            />
          </label>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="text-sm px-3 py-1.5 rounded bg-foreground text-background disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create coupon"}
        </button>
      </form>

      {/* ── List ── */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Existing coupons ({coupons.length})</p>
        {coupons.length === 0 && (
          <p className="text-sm text-muted-foreground">No coupons yet.</p>
        )}
        <div className="space-y-2">
          {coupons.map((c) => {
            const limitReached = c.max_redemptions != null && c.redemptions_count >= c.max_redemptions;
            const expired = c.expires_at ? new Date(c.expires_at).getTime() < Date.now() : false;
            const effectivelyOff = !c.is_active || limitReached || expired;
            return (
              <div
                key={c.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                  effectivelyOff ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-mono font-semibold">{c.code}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                      {c.access_type === "free" ? "free access" : `${c.discount_percent}% off`}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                      → {c.plan_granted === "premium" ? "Premium" : "Pro"}
                    </span>
                    {!c.is_active && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                        inactive
                      </span>
                    )}
                    {limitReached && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                        limit reached
                      </span>
                    )}
                    {expired && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                        expired
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.redemptions_count} / {c.max_redemptions ?? "∞"} redeemed
                    {c.expires_at && <> · expires {fmtDate(c.expires_at)}</>}
                    {c.note && <> · {c.note}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(c)}
                    disabled={busyId === c.id}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-50"
                  >
                    {c.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={busyId === c.id}
                    className="text-xs px-2 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
