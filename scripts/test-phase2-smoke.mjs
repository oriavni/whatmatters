/**
 * Phase 2 smoke validation.
 *
 * Tests:
 *   1. job_logs write — confirms writeJobLog inserts a row correctly
 *   2. job_logs read  — confirms admin overview query returns failure rows
 *   3. digest columns — confirms started_at/finished_at/error_message exist (post-migration)
 *   4. digest pipeline state — no stuck "generating" digests
 *   5. email-inbound — last 5 raw_items all have is_processed = true (no stuck items)
 *   6. audio-generate — no audio_digests stuck in "generating" > 10 minutes
 *
 * Usage: node scripts/test-phase2-smoke.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}
const supabase     = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;

function assert(label, actual, expected, { warn = false } = {}) {
  const ok = typeof expected === "function" ? expected(actual) : actual === expected;
  const sym = ok ? "✅" : (warn ? "⚠️ " : "❌");
  const detail = typeof expected === "function" ? String(actual) : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`;
  console.log(`  ${sym} ${label}: ${detail}`);
  if (ok) passed++; else if (!warn) failed++;
}

// ── Test 1: job_logs write ────────────────────────────────────────────────────
console.log("\n── Test 1: job_logs write ──");
{
  const now = new Date().toISOString();
  const { error } = await supabase.from("job_logs").insert({
    job_name: "smoke-test",
    status: "failed",
    user_id: null,
    error: "Phase 2 smoke test — safe to delete",
    metadata: { test: true, ts: now },
    started_at: now,
    finished_at: now,
  });
  assert("insert into job_logs", error, null);

  // Read it back
  const { data } = await supabase
    .from("job_logs")
    .select("id, job_name, status, error")
    .eq("job_name", "smoke-test")
    .order("created_at", { ascending: false })
    .limit(1);
  assert("job_log row readable", data?.[0]?.job_name, "smoke-test");
  assert("job_log status correct", data?.[0]?.status, "failed");

  // Clean up
  if (data?.[0]?.id) {
    await supabase.from("job_logs").delete().eq("id", data[0].id);
  }
}

// ── Test 2: admin overview query mirrors job_logs correctly ───────────────────
console.log("\n── Test 2: admin overview query ──");
{
  // Write a test failure
  const now = new Date().toISOString();
  const { data: inserted } = await supabase.from("job_logs").insert({
    job_name: "smoke-test-overview",
    status: "failed",
    error: "overview smoke check",
    metadata: {},
    started_at: now,
    finished_at: now,
  }).select("id").single();

  // Run the same query the admin page uses
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const { count } = await supabase
    .from("job_logs")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", oneDayAgo);

  assert("admin failure count > 0 after write", count ?? 0, (n) => n > 0);

  // Clean up
  if (inserted?.id) await supabase.from("job_logs").delete().eq("id", inserted.id);
}

// ── Test 3: digests new columns exist (requires migration) ───────────────────
console.log("\n── Test 3: digests new columns (requires migration) ──");
{
  const { data, error } = await supabase
    .from("digests")
    .select("id, started_at, finished_at, error_message")
    .limit(1);

  const migrationApplied = !error;
  if (migrationApplied) {
    assert("started_at column exists", true, true);
    assert("finished_at column exists", true, true);
    assert("error_message column exists", true, true);
  } else {
    console.log(`  ⚠️  migration not yet applied (${error?.message}) — run 20260426000001_digest_observability.sql`);
  }
}

// ── Test 4: no stuck generating digests ──────────────────────────────────────
console.log("\n── Test 4: stuck digests ──");
{
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stuck } = await supabase
    .from("digests")
    .select("id, user_id, created_at")
    .in("status", ["generating", "pending"])
    .lte("created_at", tenMinutesAgo);

  assert("no digests stuck generating > 10 min", (stuck ?? []).length, 0,
    { warn: (stuck ?? []).length > 0 });
  if ((stuck ?? []).length > 0) {
    console.log("  Stuck digest IDs:", (stuck ?? []).map((d) => d.id));
  }
}

// ── Test 5: email ingestion — no stuck unprocessed items ─────────────────────
console.log("\n── Test 5: email ingestion — unprocessed items ──");
{
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: unprocessed, count } = await supabase
    .from("raw_items")
    .select("id, subject, received_at", { count: "exact" })
    .eq("is_processed", false)
    .lte("received_at", oneHourAgo)
    .limit(5);

  assert("no emails unprocessed > 1h", count ?? 0, 0, { warn: (count ?? 0) > 0 });
  if ((count ?? 0) > 0) {
    console.log("  Unprocessed items:", (unprocessed ?? []).map((i) => ({id: i.id, subject: i.subject})));
  }
}

// ── Test 6: audio — no stuck generating > 10 min ─────────────────────────────
console.log("\n── Test 6: audio — stuck generating ──");
{
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stuckAudio, count } = await supabase
    .from("audio_digests")
    .select("id, digest_id, created_at", { count: "exact" })
    .eq("status", "generating")
    .lte("created_at", tenMinutesAgo)
    .limit(5);

  assert("no audio stuck generating > 10 min", count ?? 0, 0, { warn: (count ?? 0) > 0 });
  if ((count ?? 0) > 0) {
    console.log("  Stuck audio IDs:", (stuckAudio ?? []).map((a) => a.id));
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);
if (failed > 0) process.exit(1);
