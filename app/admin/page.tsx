import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { ForceGenerateButton } from "@/components/admin/ForceGenerateButton";
import { PlanSelect } from "@/components/admin/PlanSelect";
import { PricingForm } from "@/components/admin/PricingForm";

export const metadata: Metadata = { title: "Admin — WhatMatters" };

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default async function AdminPage() {
  const supabase = createServiceClient();

  const [usersResult, subsResult, sourcesResult, jobsResult, pricingResult] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, full_name, created_at")
      .order("created_at", { ascending: false }),

    supabase
      .from("subscriptions")
      .select("user_id, plan, status"),

    supabase
      .from("sources")
      .select("user_id, status"),

    supabase
      .from("job_logs")
      .select("id, job_name, status, started_at, finished_at, error, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("pricing_config")
      .select("*")
      .eq("id", "default")
      .single(),
  ]);

  const subByUser = new Map((subsResult.data ?? []).map((s) => [s.user_id, s]));
  const sourcesByUser = new Map<string, number>();
  for (const s of sourcesResult.data ?? []) {
    if (s.status === "active") {
      sourcesByUser.set(s.user_id, (sourcesByUser.get(s.user_id) ?? 0) + 1);
    }
  }

  // Fetch last digest per user
  const userIds = (usersResult.data ?? []).map((u) => u.id);
  const { data: lastDigests } = await supabase
    .from("digests")
    .select("user_id, sent_at")
    .in("user_id", userIds)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false });

  const lastDigestByUser = new Map<string, string>();
  for (const d of lastDigests ?? []) {
    if (!lastDigestByUser.has(d.user_id)) {
      lastDigestByUser.set(d.user_id, d.sent_at as string);
    }
  }

  // Fetch email by user_id for job logs
  const userEmailMap = new Map((usersResult.data ?? []).map((u) => [u.id, u.email]));

  const users = usersResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const pricing = pricingResult.data;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">WhatMatters Admin</h1>
          <span className="text-xs text-muted-foreground">{users.length} users</span>
        </div>

        {/* ── Users ──────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Users</h2>
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
                        <div>
                          <p className="font-medium">{user.email}</p>
                          {user.full_name && <p className="text-xs text-muted-foreground">{user.full_name}</p>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <PlanSelect userId={user.id} currentPlan={plan} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          subStatus === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" : "bg-muted text-muted-foreground border-border"
                        }`}>
                          {subStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{activeSources}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {formatDate(lastDigestByUser.get(user.id) ?? null)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <ForceGenerateButton userId={user.id} />
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">No users yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Pricing config ─────────────────────────────────────────────── */}
        <section className="space-y-3">
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
        </section>

        {/* ── Job logs ───────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Recent jobs <span className="text-muted-foreground font-normal">(last 50)</span></h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {["Time", "Job", "User", "Status", "Duration", "Error"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{job.job_name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {job.user_id ? (userEmailMap.get(job.user_id) ?? job.user_id.slice(0, 8)) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        job.status === "done"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                          : job.status === "failed"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDuration(job.started_at, job.finished_at)}
                    </td>
                    <td className="px-3 py-2 text-xs text-destructive max-w-xs truncate">
                      {job.error ?? "—"}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">No job logs yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
