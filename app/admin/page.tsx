import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { ForceGenerateButton } from "@/components/admin/ForceGenerateButton";
import { PlanSelect } from "@/components/admin/PlanSelect";
import { PricingForm } from "@/components/admin/PricingForm";
import { FlagsPanel } from "@/components/admin/FlagsPanel";

export const metadata: Metadata = { title: "Admin — WhatMatters" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "inbound", label: "Inbound" },
  { key: "replies", label: "Replies" },
  { key: "pricing", label: "Pricing" },
  { key: "flags", label: "Flags" },
] as const;

type Tab = typeof TABS[number]["key"];

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function MetricCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border px-5 py-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function AdminPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const tab = (searchParams.tab ?? "overview") as Tab;
  const supabase = createServiceClient();

  // ── Overview tab ────────────────────────────────────────────────────────────
  let metrics = null;
  let recentFailures: Array<{ id: string; job_name: string; error: string | null; created_at: string }> = [];

  if (tab === "overview") {
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const [emails24h, digests24h, replies24h, failures24h, totalUsers] = await Promise.all([
      supabase.from("raw_items").select("*", { count: "exact", head: true }).gte("received_at", oneDayAgo),
      supabase.from("digests").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo),
      supabase.from("reply_actions").select("*", { count: "exact", head: true }).gte("parsed_at", oneDayAgo),
      supabase.from("job_logs").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", oneDayAgo),
      supabase.from("users").select("*", { count: "exact", head: true }),
    ]);
    metrics = {
      emails: emails24h.count ?? 0,
      digests: digests24h.count ?? 0,
      replies: replies24h.count ?? 0,
      failures: failures24h.count ?? 0,
      users: totalUsers.count ?? 0,
    };
    const { data: fails } = await supabase
      .from("job_logs")
      .select("id, job_name, error, created_at")
      .eq("status", "failed")
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(10);
    recentFailures = fails ?? [];
  }

  // ── Users tab ───────────────────────────────────────────────────────────────
  let users: Array<{ id: string; email: string; full_name: string | null; created_at: string }> = [];
  let subByUser = new Map<string, { plan: string; status: string }>();
  let sourcesByUser = new Map<string, number>();
  let lastDigestByUser = new Map<string, string>();

  if (tab === "users") {
    const [usersResult, subsResult, sourcesResult] = await Promise.all([
      supabase.from("users").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("user_id, plan, status"),
      supabase.from("sources").select("user_id, status"),
    ]);
    users = usersResult.data ?? [];
    subByUser = new Map((subsResult.data ?? []).map((s) => [s.user_id, s]));
    for (const s of sourcesResult.data ?? []) {
      if (s.status === "active") sourcesByUser.set(s.user_id, (sourcesByUser.get(s.user_id) ?? 0) + 1);
    }
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      const { data: lastDigests } = await supabase
        .from("digests").select("user_id, sent_at").in("user_id", userIds)
        .not("sent_at", "is", null).order("sent_at", { ascending: false });
      for (const d of lastDigests ?? []) {
        if (!lastDigestByUser.has(d.user_id)) lastDigestByUser.set(d.user_id, d.sent_at as string);
      }
    }
  }

  // ── Inbound tab ─────────────────────────────────────────────────────────────
  let inboundItems: Array<{
    id: string; subject: string | null; sender_email: string | null;
    received_at: string; is_processed: boolean; source_id: string | null; user_id: string;
  }> = [];
  let inboundUserEmails = new Map<string, string>();

  if (tab === "inbound") {
    const { data: items } = await supabase
      .from("raw_items")
      .select("id, subject, sender_email, received_at, is_processed, source_id, user_id")
      .order("received_at", { ascending: false })
      .limit(100);
    inboundItems = items ?? [];
    const uids = [...new Set(inboundItems.map((i) => i.user_id))];
    if (uids.length > 0) {
      const { data: uRows } = await supabase.from("users").select("id, email").in("id", uids);
      inboundUserEmails = new Map((uRows ?? []).map((u) => [u.id, u.email]));
    }
  }

  // ── Replies tab ─────────────────────────────────────────────────────────────
  let replyRows: Array<{
    id: string; action: string; raw_reply: string | null; via: string | null;
    parsed_at: string; user_id: string;
  }> = [];
  let replyUserEmails = new Map<string, string>();

  if (tab === "replies") {
    const { data: rows } = await supabase
      .from("reply_actions")
      .select("id, action, raw_reply, via, parsed_at, user_id")
      .order("parsed_at", { ascending: false })
      .limit(100);
    replyRows = rows ?? [];
    const uids = [...new Set(replyRows.map((r) => r.user_id))];
    if (uids.length > 0) {
      const { data: uRows } = await supabase.from("users").select("id, email").in("id", uids);
      replyUserEmails = new Map((uRows ?? []).map((u) => [u.id, u.email]));
    }
  }

  // ── Pricing tab ─────────────────────────────────────────────────────────────
  let pricing = null;
  if (tab === "pricing") {
    const { data } = await supabase.from("pricing_config").select("*").eq("id", "default").single();
    pricing = data;
  }

  // ── Flags tab ───────────────────────────────────────────────────────────────
  let flags: Array<{ key: string; value: boolean; description: string | null }> = [];
  if (tab === "flags") {
    const { data } = await supabase.from("system_flags").select("key, value, description").order("key");
    flags = data ?? [];
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">WhatMatters Admin</h1>
        </div>

        {/* Tab nav */}
        <nav className="flex gap-1 border-b">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin?tab=${t.key}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        {tab === "overview" && metrics && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard label="Total users" value={metrics.users} />
              <MetricCard label="Emails received" value={metrics.emails} sub="last 24h" />
              <MetricCard label="Digests generated" value={metrics.digests} sub="last 24h" />
              <MetricCard label="Replies processed" value={metrics.replies} sub="last 24h" />
              <MetricCard label="Job failures" value={metrics.failures} sub="last 24h" />
            </div>

            {recentFailures.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium">Recent failures</h2>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        {["Time", "Job", "Error"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {recentFailures.map((f) => (
                        <tr key={f.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(f.created_at)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{f.job_name}</td>
                          <td className="px-3 py-2 text-xs text-destructive max-w-lg truncate">{f.error ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {recentFailures.length === 0 && (
              <p className="text-sm text-muted-foreground">No job failures in the last 24h ✓</p>
            )}
          </div>
        )}

        {/* ── Users ─────────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{users.length} users — click a row to see detail</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["Email", "Plan", "Status", "Sources", "Last digest", "Joined", "Actions"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => {
                    const sub = subByUser.get(user.id);
                    const activeSources = sourcesByUser.get(user.id) ?? 0;
                    const plan = (sub?.plan ?? "free") as "free" | "pro" | "lifetime";
                    const subStatus = sub?.status ?? "—";
                    return (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/users/${user.id}`} className="hover:underline underline-offset-2">
                            <p className="font-medium">{user.email}</p>
                            {user.full_name && <p className="text-xs text-muted-foreground">{user.full_name}</p>}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <PlanSelect userId={user.id} currentPlan={plan} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                            subStatus === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                              : "bg-muted text-muted-foreground border-border"
                          }`}>{subStatus}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{activeSources}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{formatDate(lastDigestByUser.get(user.id))}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{formatDate(user.created_at)}</td>
                        <td className="px-3 py-2.5">
                          <ForceGenerateButton userId={user.id} />
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">No users yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Inbound ───────────────────────────────────────────────────────── */}
        {tab === "inbound" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Last 100 inbound emails across all users — click a row for detail</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["Subject", "User", "Sender", "Received", "Processed", "Attributed"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inboundItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 max-w-xs">
                        <Link href={`/admin/inbound/${item.id}`} className="hover:underline underline-offset-2 truncate block">
                          {item.subject ?? "(no subject)"}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{inboundUserEmails.get(item.user_id) ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{item.sender_email ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(item.received_at)}</td>
                      <td className="px-3 py-2 text-xs">{item.is_processed ? "✓" : "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {item.source_id ? "✓" : <span className="text-amber-600">No</span>}
                      </td>
                    </tr>
                  ))}
                  {inboundItems.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No inbound emails yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Replies ───────────────────────────────────────────────────────── */}
        {tab === "replies" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Last 100 reply commands processed</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["User", "Intent", "Topic / Source", "Action", "Via", "Time"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {replyRows.map((r) => {
                    let parsed: { intent?: string; topic?: string; source?: string; schedule?: string } = {};
                    try { parsed = JSON.parse(r.raw_reply ?? "{}"); } catch {}
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {replyUserEmails.get(r.user_id) ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{parsed.intent ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {parsed.topic ?? parsed.source ?? parsed.schedule ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.action}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                            r.via === "inngest"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                              : r.via === "inline"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                              : "bg-muted text-muted-foreground border-border"
                          }`}>
                            {r.via ?? "unknown"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.parsed_at)}</td>
                      </tr>
                    );
                  })}
                  {replyRows.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No reply commands yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        {tab === "pricing" && (
          <div className="space-y-3 max-w-lg">
            <div>
              <h2 className="text-sm font-medium">Pricing & Offers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Controls the public pricing page and any active deals.</p>
            </div>
            <div className="rounded-lg border p-5">
              {pricing ? (
                <PricingForm initial={{
                  price_monthly: pricing.price_monthly as number,
                  trial_days: pricing.trial_days as number,
                  deal_active: pricing.deal_active as boolean,
                  deal_label: pricing.deal_label as string,
                  deal_price_monthly: pricing.deal_price_monthly as number,
                  deal_slots_total: pricing.deal_slots_total as number,
                  deal_slots_remaining: pricing.deal_slots_remaining as number,
                }} />
              ) : (
                <p className="text-sm text-muted-foreground">Run the migration to enable pricing config.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Flags ─────────────────────────────────────────────────────────── */}
        {tab === "flags" && (
          <div className="space-y-3 max-w-lg">
            <div>
              <h2 className="text-sm font-medium">System flags</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Operational kill switches. <span className="font-medium">Wired</span> = enforced in code.{" "}
                <span className="font-medium">UI only</span> = stored but not yet enforced.
              </p>
            </div>
            <FlagsPanel initialFlags={flags} />
          </div>
        )}

      </div>
    </div>
  );
}
