/**
 * Trial enforcement end-to-end test.
 * Runs against the live DB using the same queries as isUserPremium / canGenerateAudio.
 * Restores the original subscription state at the end.
 *
 * Usage: node scripts/test-trial-enforcement.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}
const USER_ID      = "e718b2f5-0f75-4e05-a20f-26fea8a88090";
const AUDIO_MONTHLY_CAP = 20;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Exact replica of isUserPremium from lib/audio/premium.ts ─────────────────

async function isUserPremium(userId) {
  const [{ data: userRow }, subResult] = await Promise.all([
    supabase.from("users").select("is_premium_override").eq("id", userId).single(),
    supabase
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (userRow?.is_premium_override === true) return true;

  if (subResult.error) {
    const { data: fallback } = await supabase
      .from("subscriptions").select("status").eq("user_id", userId).maybeSingle();
    return fallback?.status === "active" || fallback?.status === "trialing";
  }

  const subRow = subResult.data;
  if (!subRow) return false;
  if (subRow.status === "active") return true;
  if (subRow.status === "trialing") {
    if (!subRow.trial_end) return true;
    return new Date(subRow.trial_end) > new Date();
  }
  return false;
}

async function canGenerateAudio(userId) {
  const premium = await isUserPremium(userId);
  if (!premium) return { allowed: false, reason: "not_premium" };

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("audio_digests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "failed")
    .gte("created_at", since);

  if ((count ?? 0) >= AUDIO_MONTHLY_CAP) return { allowed: false, reason: "cap_reached" };
  return { allowed: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function setState({ status, trial_end, is_premium_override }) {
  // Update subscription
  const { error: subErr } = await supabase
    .from("subscriptions")
    .update({ status, trial_end: trial_end ?? null, updated_at: new Date().toISOString() })
    .eq("user_id", USER_ID);
  if (subErr) throw new Error(`setState subscriptions: ${subErr.message}`);

  // Update override flag
  const { error: userErr } = await supabase
    .from("users")
    .update({ is_premium_override })
    .eq("id", USER_ID);
  if (userErr) throw new Error(`setState users: ${userErr.message}`);
}

async function getState() {
  const [{ data: sub }, { data: u }] = await Promise.all([
    supabase.from("subscriptions").select("status,trial_end").eq("user_id", USER_ID).single(),
    supabase.from("users").select("is_premium_override").eq("id", USER_ID).single(),
  ]);
  return { ...sub, is_premium_override: u?.is_premium_override };
}

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  const ok = actual === expected;
  const sym = ok ? "✅" : "❌";
  console.log(`  ${sym} ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  if (ok) passed++; else failed++;
}

// ── Test runner ───────────────────────────────────────────────────────────────

async function runTests() {
  // Save original state so we can restore it
  const original = await getState();
  console.log(`\nOriginal DB state:`, original, "\n");

  // ── Scenario 1: Free / no subscription ───────────────────────────────────
  console.log("── Scenario 1: Free user (delete subscription row) ──");
  // Delete the row to simulate no subscription
  await supabase.from("subscriptions").delete().eq("user_id", USER_ID);
  await supabase.from("users").update({ is_premium_override: false }).eq("id", USER_ID);

  const s1_premium = await isUserPremium(USER_ID);
  const s1_gen = await canGenerateAudio(USER_ID);
  assert("isUserPremium", s1_premium, false);
  assert("canGenerateAudio.allowed", s1_gen.allowed, false);
  assert("canGenerateAudio.reason", s1_gen.reason, "not_premium");

  // Restore a subscription row for remaining tests
  await supabase.from("subscriptions").insert({
    user_id: USER_ID,
    plan: "free",
    status: "trialing",
    trial_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // ── Scenario 2: Active trial (trial_end in future) ────────────────────────
  console.log("\n── Scenario 2: Active trial (trial_end = +5 days) ──");
  await setState({
    status: "trialing",
    trial_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    is_premium_override: false,
  });

  const s2 = await getState();
  console.log(`  DB state:`, s2);

  const s2_premium = await isUserPremium(USER_ID);
  const s2_gen = await canGenerateAudio(USER_ID);
  assert("isUserPremium", s2_premium, true);
  assert("canGenerateAudio.allowed", s2_gen.allowed, true);

  // ── Scenario 3: Expired trial ─────────────────────────────────────────────
  console.log("\n── Scenario 3: Expired trial (trial_end = -1 day) ──");
  await setState({
    status: "trialing",
    trial_end: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    is_premium_override: false,
  });

  const s3 = await getState();
  console.log(`  DB state:`, s3);

  const s3_premium = await isUserPremium(USER_ID);
  const s3_gen = await canGenerateAudio(USER_ID);
  assert("isUserPremium", s3_premium, false);
  assert("canGenerateAudio.allowed", s3_gen.allowed, false);
  assert("canGenerateAudio.reason", s3_gen.reason, "not_premium");

  // ── Scenario 4: Admin override ────────────────────────────────────────────
  console.log("\n── Scenario 4: Admin override (is_premium_override = true) ──");
  // Keep expired trial to confirm override bypasses it
  await setState({
    status: "trialing",
    trial_end: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    is_premium_override: true,
  });

  const s4 = await getState();
  console.log(`  DB state:`, s4);

  const s4_premium = await isUserPremium(USER_ID);
  const s4_gen = await canGenerateAudio(USER_ID);
  assert("isUserPremium", s4_premium, true);
  assert("canGenerateAudio.allowed", s4_gen.allowed, true);

  // ── Restore original state ────────────────────────────────────────────────
  console.log("\n── Restoring original state ──");
  await setState({
    status: original.status,
    trial_end: original.trial_end,
    is_premium_override: original.is_premium_override,
  });
  const restored = await getState();
  console.log(`  Restored:`, restored);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
