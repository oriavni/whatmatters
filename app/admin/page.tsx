import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin" };

/**
 * Internal admin panel.
 * Protected by ADMIN_SECRET header check (see middleware or a separate check).
 * TODO (Prompt 12): Implement job logs viewer, force-generate, raw_items viewer.
 */
export default function AdminPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-xl font-semibold">WhatMatters Admin</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Recent job logs", "Raw items (24h)", "Force generate"].map((panel) => (
          <div
            key={panel}
            className="border rounded-lg p-4 text-sm text-muted-foreground"
          >
            {panel} — coming in Prompt 12
          </div>
        ))}
      </div>
    </div>
  );
}
