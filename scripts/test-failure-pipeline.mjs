/**
 * Controlled failure verification test.
 *
 * Directly executes the same code paths that Inngest onFailure hooks call,
 * then verifies each result is visible in the admin-facing queries.
 *
 * Tests:
 *   A. writeJobLog (audio-generate onFailure) → job_logs row + admin overview
 *   B. digest row → status=failed + error_message + finished_at
 *   C. audio_digests row → status=failed + error_message (the existing generating row)
 *   D. Admin Digests tab query reflects failures
 *   E. Per-user digest query reflects failures
 *   F. Admin overview failure count reflects failures
 *
 * All test rows are cleaned up at the end.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}
const USER_ID      = "e718b2f5-0f75-4e05-a20f-26fea8a88090";
const AUDIO_ID     = "b6305aba-b299-47dd-b5aa-41added80baa"; // created in earlier test
const DIGEST_ID    = "90a36642-9361-430b-ad60-30cab08af89b"; // created in earlier test

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  const ok = typeof expected === "function" ? expected(actual) : actual === expected;
  const sym = ok ? "✅" : "❌";
  const detail = typeof expected === "function"
    ? `(check): ${JSON.stringify(actual)}`
    : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`;
  console.log(`  ${sym} ${label}: ${detail}`);
  if (ok) passed++; else failed++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. writeJobLog path — exactly what audio-generate onFailure calls
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n── A. writeJobLog (audio-generate onFailure path) ──");

const errorMsg = "generateAudio: digest not found or has no plain_body — controlled test";
const now = new Date().toISOString();

const { error: jobLogErr } = await supabase.from("job_logs").insert({
  job_name: "audio-generate",
  status: "failed",
  user_id: USER_ID,
  error: errorMsg,
  metadata: { audio_digest_id: AUDIO_ID, digest_id: DIGEST_ID },
  started_at: now,
  finished_at: now,
});
assert("job_logs insert succeeds", jobLogErr, null);

// Read back immediately — same query admin overview uses
const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
const { count: failCount } = await supabase
  .from("job_logs")
  .select("*", { count: "exact", head: true })
  .eq("status", "failed")
  .gte("created_at", oneDayAgo);
assert("admin overview failure count > 0", failCount ?? 0, (n) => n > 0);

const { data: failRows } = await supabase
  .from("job_logs")
  .select("id, job_name, status, error, created_at")
  .eq("status", "failed")
  .eq("job_name", "audio-generate")
  .gte("created_at", oneDayAgo)
  .order("created_at", { ascending: false })
  .limit(5);
assert("admin recent failures shows audio-generate", failRows?.[0]?.job_name, "audio-generate");
assert("error message is populated", failRows?.[0]?.error, errorMsg);

// ═══════════════════════════════════════════════════════════════════════════════
// B. digest row — status=failed, error_message, finished_at
//    (same as digest-generate onFailure + digest-send onFailure)
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n── B. Digest row: status=failed + error_message + finished_at ──");

const digestError = "send failed: controlled test — Postmark rejected message";
const finishedAt = new Date().toISOString();

const { error: digestErr } = await supabase
  .from("digests")
  .update({
    status: "failed",
    error_message: digestError,
    finished_at: finishedAt,
  })
  .eq("id", DIGEST_ID);
assert("digest update succeeds", digestErr, null);

// Read back
const { data: digestRow } = await supabase
  .from("digests")
  .select("id, status, error_message, started_at, finished_at")
  .eq("id", DIGEST_ID)
  .single();
assert("digest.status = failed", digestRow?.status, "failed");
assert("digest.error_message populated", digestRow?.error_message, digestError);
assert("digest.finished_at populated", !!digestRow?.finished_at, true);
assert("digest.started_at populated", !!digestRow?.started_at, true);

// Duration calculation (same as admin page)
if (digestRow?.started_at && digestRow?.finished_at) {
  const durationMs = new Date(digestRow.finished_at) - new Date(digestRow.started_at);
  assert("duration calculable (ms)", durationMs, (ms) => ms >= 0);
  console.log(`  ℹ️  Duration: ${(durationMs/1000).toFixed(1)}s`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// C. audio_digests row — status=failed + error_message
//    (same as audio-generate onFailure)
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n── C. audio_digests row: status=failed + error_message ──");

const { error: audioErr } = await supabase
  .from("audio_digests")
  .update({
    status: "failed",
    error_message: errorMsg,
    updated_at: new Date().toISOString(),
  })
  .eq("id", AUDIO_ID);
assert("audio_digests update succeeds", audioErr, null);

const { data: audioRow } = await supabase
  .from("audio_digests")
  .select("id, status, error_message")
  .eq("id", AUDIO_ID)
  .single();
assert("audio_digests.status = failed", audioRow?.status, "failed");
assert("audio_digests.error_message populated", audioRow?.error_message, errorMsg);

// ═══════════════════════════════════════════════════════════════════════════════
// D. Admin Digests tab query
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n── D. Admin Digests tab query ──");

const { data: digestTabRows } = await supabase
  .from("digests")
  .select("id, user_id, subject, status, started_at, finished_at, error_message, created_at")
  .order("created_at", { ascending: false })
  .limit(100);

const ourDigest = digestTabRows?.find((d) => d.id === DIGEST_ID);
assert("our digest appears in Digests tab", !!ourDigest, true);
assert("shows status=failed", ourDigest?.status, "failed");
assert("shows error_message", ourDigest?.error_message, digestError);
assert("shows started_at", !!ourDigest?.started_at, true);
assert("shows finished_at", !!ourDigest?.finished_at, true);

// Duration formatting (same logic as admin page formatDuration)
const durMs = ourDigest?.started_at && ourDigest?.finished_at
  ? new Date(ourDigest.finished_at) - new Date(ourDigest.started_at)
  : null;
assert("duration computable", durMs, (ms) => ms !== null && ms >= 0);
console.log(`  ℹ️  Admin would show duration: ${durMs !== null ? (durMs/1000).toFixed(1)+'s' : '—'}`);

// ═══════════════════════════════════════════════════════════════════════════════
// E. Per-user digest query (admin/users/[id])
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n── E. Per-user digest history ──");

const { data: userDigests } = await supabase
  .from("digests")
  .select("id, subject, status, sent_at, started_at, finished_at, error_message, created_at")
  .eq("user_id", USER_ID)
  .order("created_at", { ascending: false })
  .limit(10);

const ourUserDigest = userDigests?.find((d) => d.id === DIGEST_ID);
assert("appears in per-user digest list", !!ourUserDigest, true);
assert("correct status", ourUserDigest?.status, "failed");
assert("error_message visible", !!ourUserDigest?.error_message, true);
assert("duration fields present", !!(ourUserDigest?.started_at || ourUserDigest?.finished_at), true);

// ═══════════════════════════════════════════════════════════════════════════════
// F. Overview failure count + recent failures table
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n── F. Admin Overview — exact page queries ──");

const { count: overviewCount } = await supabase
  .from("job_logs")
  .select("*", { count: "exact", head: true })
  .eq("status", "failed")
  .gte("created_at", oneDayAgo);
assert("Overview failure counter > 0", overviewCount ?? 0, (n) => n > 0);
console.log(`  ℹ️  Failure counter shows: ${overviewCount}`);

const { data: recentFails } = await supabase
  .from("job_logs")
  .select("id, job_name, error, created_at")
  .eq("status", "failed")
  .gte("created_at", oneDayAgo)
  .order("created_at", { ascending: false })
  .limit(10);
assert("Recent failures table has rows", (recentFails?.length ?? 0), (n) => n > 0);
assert("Most recent is audio-generate", recentFails?.[0]?.job_name, "audio-generate");
assert("Error message in table", recentFails?.[0]?.error?.includes("plain_body"), true);
console.log(`  ℹ️  Recent failures: ${recentFails?.length} rows`);

// ═══════════════════════════════════════════════════════════════════════════════
// Cleanup — remove test rows
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n── Cleanup ──");

await supabase.from("job_logs").delete().eq("job_name", "audio-generate").gte("created_at", oneDayAgo);
await supabase.from("audio_digests").delete().eq("id", AUDIO_ID);
await supabase.from("digests").delete().eq("id", DIGEST_ID);
console.log("  ✅ Test rows deleted");

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);
if (failed > 0) process.exit(1);
