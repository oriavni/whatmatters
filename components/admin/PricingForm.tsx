"use client";

/**
 * Admin pricing configuration form.
 *
 * Covers three sections:
 *   1. Base pricing — monthly price and trial days
 *   2. Deal / founding-member offer — toggled on/off
 *   3. Pro / Premium plan — toggled on/off via a Switch; shown on the
 *      marketing pricing page when pro_visible is true
 */

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PricingConfig {
  price_monthly: number;
  trial_days: number;
  deal_active: boolean;
  deal_label: string;
  deal_price_monthly: number;
  deal_slots_total: number;
  deal_slots_remaining: number;
  pro_visible: boolean;
  pro_price_monthly: number;
  pro_label: string;
  pro_audio_limit: number;
  pro_description: string;
}

export function PricingForm({ initial }: { initial: PricingConfig }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof PricingConfig>(key: K, value: PricingConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Base pricing ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Monthly price ($)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price_monthly}
            onChange={(e) => set("price_monthly", parseFloat(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="Trial days">
          <input
            type="number"
            min="0"
            value={form.trial_days}
            onChange={(e) => set("trial_days", parseInt(e.target.value))}
            className={inputCls}
          />
        </Field>
      </div>

      {/* ── Deal / founding-member offer ──────────────────────────── */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.deal_active}
          onChange={(e) => set("deal_active", e.target.checked)}
          className="rounded"
        />
        <span className="text-sm font-medium">Deal active (show on pricing page)</span>
      </label>

      <div className={`space-y-4 ${form.deal_active ? "" : "opacity-40 pointer-events-none"}`}>
        <Field label="Deal label">
          <input
            type="text"
            value={form.deal_label}
            onChange={(e) => set("deal_label", e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Deal price ($)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.deal_price_monthly}
              onChange={(e) => set("deal_price_monthly", parseFloat(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Total slots">
            <input
              type="number"
              min="0"
              value={form.deal_slots_total}
              onChange={(e) => set("deal_slots_total", parseInt(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Remaining slots">
            <input
              type="number"
              min="0"
              value={form.deal_slots_remaining}
              onChange={(e) => set("deal_slots_remaining", parseInt(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {/* ── Pro / Premium plan ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pro / Premium plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="pro_visible"
              checked={form.pro_visible}
              onCheckedChange={(checked) => set("pro_visible", checked)}
            />
            <Label htmlFor="pro_visible" className="cursor-pointer text-sm font-medium">
              Show Pro plan on pricing page
            </Label>
          </div>

          {/* Pro fields — dimmed when the plan is hidden */}
          <div className={`space-y-4 ${form.pro_visible ? "" : "opacity-40 pointer-events-none"}`}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Plan label">
                <Input
                  type="text"
                  value={form.pro_label}
                  onChange={(e) => set("pro_label", e.target.value)}
                />
              </Field>
              <Field label="Monthly price ($)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pro_price_monthly}
                  onChange={(e) => set("pro_price_monthly", parseFloat(e.target.value))}
                />
              </Field>
            </div>

            <Field label="Audio Brief limit (per month)">
              <Input
                type="number"
                min="0"
                value={form.pro_audio_limit}
                onChange={(e) => set("pro_audio_limit", parseInt(e.target.value))}
              />
            </Field>

            <Field label="Plan description (shown on pricing page)">
              <input
                type="text"
                value={form.pro_description}
                onChange={(e) => set("pro_description", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Save ──────────────────────────────────────────────────── */}
      <Button onClick={handleSave} disabled={saving} variant="default" size="sm">
        {saving ? "Saving…" : saved ? "✓ Saved" : "Save pricing"}
      </Button>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring";
