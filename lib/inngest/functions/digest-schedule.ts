/**
 * Hourly cron that triggers digest generation for users whose scheduled
 * delivery time falls in the current UTC hour.
 *
 * Design decisions:
 *  - Runs every hour on the hour ("0 * * * *")
 *  - digest_time is treated as UTC (no per-user timezone yet)
 *  - Idempotent: skips users who already have a non-failed digest in the
 *    current window (today for daily, current week Mon-start for weekly)
 *  - Fires digest/generate concurrently for all due users; the generate
 *    function itself has concurrency:1 per user as a second guard
 *  - Safe retry: Inngest will re-run this function on failure; the
 *    idempotency check prevents double-generation
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";

export const digestSchedule = inngest.createFunction(
  {
    id: "digest-schedule",
    name: "Schedule Digests (hourly)",
    triggers: [{ cron: "0 * * * *" }],
    retries: 1,
  },
  async ({ step }) => {
    const now = new Date();
    const currentHour = now.getUTCHours();
    // 0 = Sunday … 6 = Saturday (matches SQL DOW convention)
    const currentDow = now.getUTCDay();

    // ── Step 1: Find users whose digest_time matches this hour ────────────
    const dueUsers = await step.run("find-due-users", async () => {
      const supabase = createServiceClient();

      // Fetch all preferences where the hour component of digest_time matches.
      // Supabase doesn't expose EXTRACT in the JS client, so we pull all rows
      // and filter in JS. User count is small enough that this is fine.
      const { data, error } = await supabase
        .from("user_preferences")
        .select("user_id, digest_frequency, digest_time, digest_day");

      if (error) throw new Error(`find-due-users: ${error.message}`);

      const rows = data ?? [];

      return rows.filter((pref) => {
        // digest_time is "HH:MM:SS" from Postgres time type
        const hour = parseInt(pref.digest_time?.split(":")[0] ?? "7", 10);
        if (hour !== currentHour) return false;

        if (pref.digest_frequency === "weekly") {
          // Only fire on the user's chosen day of week
          return pref.digest_day === currentDow;
        }

        // daily — time matched, always fire
        return true;
      }).map((pref) => ({
        user_id: pref.user_id,
        frequency: pref.digest_frequency as "daily" | "weekly",
      }));
    });

    if (dueUsers.length === 0) {
      return { fired: 0, message: "No users due at this hour" };
    }

    // ── Step 2: Idempotency check — skip users who already have a digest ──
    const usersToFire = await step.run("idempotency-check", async () => {
      const supabase = createServiceClient();

      // Window start: beginning of today UTC for daily, beginning of
      // current ISO week (Monday) for weekly.
      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      ).toISOString();

      // Start of current week (Monday = day 1; adjust Sunday=0 → 6)
      const dowOffset = currentDow === 0 ? 6 : currentDow - 1;
      const weekStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dowOffset)
      ).toISOString();

      const userIds = dueUsers.map((u) => u.user_id);

      // Fetch digests generated in the current window for these users
      const { data: recentDigests } = await supabase
        .from("digests")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .neq("status", "failed")
        .gte("created_at", weekStart); // weekStart ≤ todayStart always

      const alreadyGeneratedThisWeek = new Set(
        (recentDigests ?? []).map((d) => d.user_id)
      );
      const alreadyGeneratedToday = new Set(
        (recentDigests ?? [])
          .filter((d) => d.created_at >= todayStart)
          .map((d) => d.user_id)
      );

      return dueUsers.filter(({ user_id, frequency }) => {
        if (frequency === "weekly") {
          return !alreadyGeneratedThisWeek.has(user_id);
        }
        // daily
        return !alreadyGeneratedToday.has(user_id);
      });
    });

    if (usersToFire.length === 0) {
      return { fired: 0, message: "All due users already have digests" };
    }

    // ── Step 3: Fire digest/generate for each user ─────────────────────────
    await step.run("fire-events", async () => {
      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      await inngest.send(
        usersToFire.map(({ user_id }) => ({
          name: "digest/generate" as const,
          data: {
            user_id,
            trigger: "scheduled" as const,
            period_start: yesterday,
            period_end: now,
          },
        }))
      );
    });

    return {
      fired: usersToFire.length,
      skipped: dueUsers.length - usersToFire.length,
      users: usersToFire.map((u) => u.user_id),
    };
  }
);
