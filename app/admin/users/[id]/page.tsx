import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { config } from "@/lib/config";
import { CopyButton } from "@/components/admin/CopyButton";
import { ForceGenerateButton } from "@/components/admin/ForceGenerateButton";
import { ResetPreferencesButton } from "@/components/admin/ResetPreferencesButton";
import { PlanSelect } from "@/components/admin/PlanSelect";
import { SimulateReplyForm } from "@/components/admin/SimulateReplyForm";

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default async function UserDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = createServiceClient();

  const [
    userResult,
    subResult,
    sourcesResult,
    rawItemsResult,
    digestsResult,
    repliesResult,
    interestsResult,
    suppressionsResult,
    prefsResult,
    audioResult,
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", id).single(),
    supabase.from("subscriptions").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("sources").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("raw_items").select("id, subject, sender_email, received_at, is_processed, source_id")
      .eq("user_id", id).order("received_at", { ascending: false }).limit(10),
    supabase.from("digests").select("id, subject, status, sent_at, created_at")
      .eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("reply_actions").select("id, action, raw_reply, via, parsed_at")
      .eq("user_id", id).order("parsed_at", { ascending: false }).limit(10),
    supabase.from("topic_interests").select("topic, weight, updated_at")
      .eq("user_id", id).order("weight", { ascending: false }),
    supabase.from("topic_suppressions").select("topic, suppress_level, digests_remaining, updated_at")
      .eq("user_id", id).gt("digests_remaining", 0),
    supabase.from("user_preferences").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("audio_digests")
      .select("id, status, file_size_bytes, error_message, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!userResult.data) notFound();

  const user = userResult.data;
  const sub = subResult.data;
  const sources = sourcesResult.data ?? [];
  const rawItems = rawItemsResult.data ?? [];
  const digests = digestsResult.data ?? [];
  const replies = repliesResult.data ?? [];
  const interests = interestsResult.data ?? [];
  const suppressions = suppressionsResult.data ?? [];
  const prefs = prefsResult.data;
  const audioRows = audioResult.data ?? [];

  const inboundAddress = `${user.inbound_slug}@${config.postmark.inboundDomain}`;

  // Source attribution issues: sources with errors
  const problemSources = sources.filter((s) => s.status === "error" || s.error_message);
  // Unattributed inbound items (newsletter type, no source_id)
  const unattributedCount = rawItems.filter((r) => !r.source_id).length;

  const plan = (sub?.plan ?? "free") as "free" | "pro" | "lifetime";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Back */}
        <Link href="/admin?tab=users" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back to users
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{user.email}</h1>
            {user.full_name && <p className="text-sm text-muted-foreground">{user.full_name}</p>}
            <p className="text-xs text-muted-foreground mt-1">Joined {formatDate(user.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <PlanSelect userId={user.id} currentPlan={plan} />
            <ForceGenerateButton userId={user.id} />
            <ResetPreferencesButton userId={user.id} />
          </div>
        </div>

        {/* Inbound address */}
        <Section title="Inbound address">
          <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
            <code className="text-sm flex-1 font-mono">{inboundAddress}</code>
            <CopyButton text={inboundAddress} />
          </div>
        </Section>

        {/* Subscription */}
        <Section title="Subscription">
          <div className="rounded-lg border divide-y divide-border">
            {[
              ["Plan", sub?.plan ?? "free"],
              ["Status", sub?.status ?? "—"],
              ["Period start", formatDate(sub?.current_period_start ?? null)],
              ["Period end", formatDate(sub?.current_period_end ?? null)],
              ["Cancel at period end", sub?.cancel_at_period_end ? "Yes" : "No"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Preferences */}
        {prefs && (
          <Section title="Preferences">
            <div className="rounded-lg border divide-y divide-border">
              {[
                ["Frequency", prefs.digest_frequency],
                ["Time", String(prefs.digest_time)],
                ["Day", prefs.digest_day != null ? prefs.digest_day : "—"],
                ["Format", prefs.email_format],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Attribution issues */}
        {(problemSources.length > 0 || unattributedCount > 0) && (
          <Section title="Attribution issues">
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-2">
              {unattributedCount > 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {unattributedCount} of last {rawItems.length} emails have no source attribution
                </p>
              )}
              {problemSources.map((s) => (
                <p key={s.id} className="text-sm text-amber-800 dark:text-amber-300">
                  Source error — <span className="font-medium">{s.name}</span>: {s.error_message ?? "status: error"}
                </p>
              ))}
            </div>
          </Section>
        )}

        {/* Sources */}
        <Section title={`Sources (${sources.length})`}>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["Name", "Type", "Status", "Last fetched", "Error"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sources.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.type}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          s.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                            : s.status === "error"
                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                            : "bg-muted text-muted-foreground border-border"
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(s.last_fetched_at)}</td>
                      <td className="px-3 py-2 text-xs text-destructive max-w-xs truncate">{s.error_message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Recent inbound emails */}
        <Section title="Recent inbound emails">
          {rawItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails received</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["Subject", "Sender", "Received", "Processed", "Attributed"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rawItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 max-w-xs">
                        <Link href={`/admin/inbound/${item.id}`} className="hover:underline underline-offset-2 truncate block">
                          {item.subject ?? "(no subject)"}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{item.sender_email ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.received_at)}</td>
                      <td className="px-3 py-2 text-xs">{item.is_processed ? "✓" : "—"}</td>
                      <td className="px-3 py-2 text-xs">{item.source_id ? "✓" : <span className="text-amber-600">No</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Digest history */}
        <Section title="Digest history">
          {digests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No digests</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["Subject", "Status", "Sent", "Created"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {digests.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 max-w-xs truncate">{d.subject ?? "(pending)"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          d.status === "sent"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                            : d.status === "failed"
                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                            : "bg-muted text-muted-foreground border-border"
                        }`}>{d.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(d.sent_at)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Reply history */}
        <Section title="Reply history">
          {replies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No replies</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["Intent", "Action", "Via", "Time"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {replies.map((r) => {
                    let parsed: { intent?: string; topic?: string; source?: string } = {};
                    try { parsed = JSON.parse(r.raw_reply ?? "{}"); } catch {}
                    return (
                      <tr key={r.id}>
                        <td className="px-3 py-2">
                          <span className="text-xs font-mono">{parsed.intent ?? "—"}</span>
                          {(parsed.topic || parsed.source) && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({parsed.topic ?? parsed.source})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.action}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.via ?? "unknown"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.parsed_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Audio activity */}
        <Section title="Audio Activity">
          {audioRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audio briefs generated</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["Created", "Status", "Size", "Error"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {audioRows.map((a) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.created_at)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                          a.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                            : a.status === "failed"
                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                            : a.status === "generating"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                            : "bg-muted text-muted-foreground border-border"
                        }`}>{a.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {a.file_size_bytes != null ? `${Math.round(a.file_size_bytes / 1024)} KB` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-destructive max-w-xs truncate">
                        {a.error_message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Topic interests */}
        {interests.length > 0 && (
          <Section title="Topic interests">
            <div className="flex flex-wrap gap-2">
              {interests.map((i) => (
                <span key={i.topic} className={`text-xs px-2 py-1 rounded-full border ${
                  i.weight === 0 ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                  : i.weight >= 2 ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-muted text-muted-foreground border-border"
                }`}>
                  {i.topic} <span className="opacity-60">({i.weight})</span>
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Suppressions */}
        {suppressions.length > 0 && (
          <Section title="Active suppressions">
            <div className="flex flex-wrap gap-2">
              {suppressions.map((s) => (
                <span key={s.topic} className="text-xs px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                  {s.topic} <span className="opacity-60">({s.digests_remaining} left)</span>
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Simulate reply */}
        <Section title="Simulate reply command">
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Runs the full reply pipeline on this user&apos;s latest digest. Sends a real confirmation email.
            </p>
            <SimulateReplyForm userId={user.id} />
          </div>
        </Section>

      </div>
    </div>
  );
}
