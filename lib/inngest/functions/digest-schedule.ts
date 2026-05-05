/**
 * Hourly cron that triggers digest generation for users whose scheduled
 * delivery time falls in the current UTC hour.
 *
 * Timezone handling:
 *   digest_time is stored as a local clock time (e.g. "08:00").
 *   users.timezone is an IANA zone string (e.g. "Asia/Jerusalem").
 *   We convert digest_time → UTC using the zone's current offset so DST
 *   is handled automatically — no library needed, just Intl.DateTimeFormat.
 *
 * Idempotency:
 *   Before firing, we check that the user has no non-failed digest in the
 *   current window (today UTC for daily, Mon-start week UTC for weekly).
 *   The digest-generate function also has concurrency:1 per user as a guard.
 */
import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/service";
import { TRIAL_DAYS, TRIAL_DIGEST_CAP } from "@/lib/digest/trial";

/**
 * Convert a local clock hour (from digest_time "HH:MM") to the equivalent
 * UTC hour, using the user's IANA timezone and the CURRENT date (so DST is
 * automatically respected).
 *
 * Example: "08:00" in "Asia/Jerusalem" during daylight saving (UTC+3) → 5 UTC
 *          "08:00" in "Asia/Jerusalem" during standard time  (UTC+2) → 6 UTC
 */
function localHourToUtc(digestTime: string, timezone: string): number {
  const localDigestHour = parseInt(digestTime.split(":")[0], 10);

  // Find the current local hour in this timezone.
  // Intl.DateTimeFormat always reflects the correct DST offset for today.
  const now = new Date();
  let currentLocalHour: number;
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(now);
    // "numeric" + hour12:false returns "0"–"23"; "24" can appear for midnight.
    currentLocalHour = parseInt(formatted, 10) % 24;
  } catch {
    // Unknown timezone — fall back to treating digest_time as UTC
    return localDigestHour;
  }

  const currentUtcHour = now.getUTCHours();
  // offset = how many hours UTC is ahead of local (negative means UTC is behind)
  const offsetHours = currentUtcHour - currentLocalHour;
  return ((localDigestHour + offsetHours) % 24 + 24) % 24;
}

export const digestSchedule = inngest.createFunction(
  {
    id: "digest-schedule",
    name: "Schedule Digests (hourly)",
    triggers: [{ cron: "0 * * * *" }],
    retries: 1,
  },
  async ({ step }) => {
    const now = new Date();
    const currentUtcHour = now.getUTCHours();
    // 0=Sunday … 6=Saturday (matches Postgres DOW)
    const currentDow = now.getUTCDay();

    // ── Step 1: Find users due at this UTC hour ───────────────────────────
    const dueUsers = await step.run("find-due-users", async () => {
      const supabase = createServiceClient();

      // Fetch preferences and timezones in parallel
      const [{ data: prefs, error: prefsErr }, { data: userRows, error: usersErr }] =
        await Promise.all([
          supabase
            .from("user_preferences")
            .select("user_id, digest_frequency, digest_time, digest_day")
            .neq("digest_frequency", "off"),
          supabase
            .from("users")
            .select("id, timezone, is_frozen" as "id, timezone"),
        ]);

      if (prefsErr) throw new Error(`find-due-users prefs: ${prefsErr.message}`);
      if (usersErr) throw new Error(`find-due-users users: ${usersErr.message}`);

      // Build timezone lookup map + frozen set.
      // The query selects "is_frozen" alongside "id, timezone" via a type cast
      // (the column exists at runtime; TS types are updated after migration runs).
      type UserRowRuntime = { id: string; timezone: string; is_frozen?: boolean };
      const rows = (userRows ?? []) as unknown as UserRowRuntime[];

      const tzMap = new Map(rows.map((u) => [u.id, u.timezone || "UTC"]));
      const frozenSet = new Set(rows.filter((u) => u.is_frozen).map((u) => u.id));

      return (prefs ?? []).filter((pref) => {
        if (!tzMap.has(pref.user_id)) return false; // unknown user
        if (frozenSet.has(pref.user_id)) return false; // frozen — skip
        const tz = tzMap.get(pref.user_id) ?? "UTC";
        const utcHour = localHourToUtc(pref.digest_time ?? "07:00", tz);

        if (utcHour !== currentUtcHour) return false;

        if (pref.digest_frequency === "weekly") {
          // Also check the user's local day of week matches
          // (derive local DOW from the same timezone offset logic)
          let localDow: number;
          try {
            const fmt = new Intl.DateTimeFormat("en-US", {
              timeZone: tz,
              weekday: "short",
            }).format(now);
            // "Sun","Mon","Tue","Wed","Thu","Fri","Sat"
            const DOW_MAP: Record<string, number> = {
              Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
            };
            localDow = DOW_MAP[fmt] ?? currentDow;
          } catch {
            localDow = currentDow;
          }
          return pref.digest_day === localDow;
        }

        return true; // daily
      }).map((pref) => ({
        user_id: pref.user_id as string,
        frequency: pref.digest_frequency as "daily" | "weekly",
      }));
    });

    if (dueUsers.length === 0) {
      return { fired: 0, message: "No users due at this hour" };
    }

    // ── Step 2: Idempotency — skip users who already have a digest ────────
    const usersToFire = await step.run("idempotency-check", async () => {
      const supabase = createServiceClient();

      const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      ).toISOString();

      // Monday of this week
      const dowOffset = currentDow === 0 ? 6 : currentDow - 1;
      const weekStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dowOffset)
      ).toISOString();

      const userIds = dueUsers.map((u) => u.user_id);

      const { data: recentDigests } = await supabase
        .from("digests")
        .select("user_id, created_at")
        .in("user_id", userIds)
        .neq("status", "failed")
        .gte("created_at", weekStart);

      const generatedThisWeek = new Set(
        (recentDigests ?? []).map((d) => d.user_id)
      );
      const generatedToday = new Set(
        (recentDigests ?? [])
          .filter((d) => d.created_at >= todayStart)
          .map((d) => d.user_id)
      );

      return dueUsers.filter(({ user_id, frequency }) =>
        frequency === "weekly"
          ? !generatedThisWeek.has(user_id)
          : !generatedToday.has(user_id)
      );
    });

    if (usersToFire.length === 0) {
      return { fired: 0, message: "All due users already have digests" };
    }

    // ── Step 2.5: Filter out trial-expired / trial-capped users ──────────
    // Trial limits must be enforced on all generation paths, not only the
    // web button. Non-premium users who have expired or exhausted their
    // 3-digest trial cap must not receive scheduled deliveries.
    const trialApprovedUsers = await step.run("trial-check", async () => {
      const supabase = createServiceClient();
      const userIds = usersToFire.map((u) => u.user_id);

      // Load premium status + account age for all candidates in one shot
      const [{ data: userRows }, { data: subRows }, { data: digestRows }] =
        await Promise.all([
          supabase
            .from("users")
            .select("id, is_premium_override, created_at" as "id")
            .in("id", userIds),
          supabase
            .from("subscriptions")
            .select("user_id, status")
            .in("user_id", userIds)
            .eq("status", "active"),
          // Fetch digest counts for non-failed digests (needed for cap check)
          supabase
            .from("digests")
            .select("user_id")
            .in("user_id", userIds)
            .not("status", "eq", "failed"),
        ]);

      type UserRow = { id: string; is_premium_override?: boolean; created_at?: string };
      const rows = (userRows ?? []) as unknown as UserRow[];

      const premiumOverrideSet = new Set(
        rows.filter((u) => u.is_premium_override).map((u) => u.id)
      );
      const activeSubSet = new Set((subRows ?? []).map((s) => s.user_id as string));
      const isPremium = (id: string) =>
        premiumOverrideSet.has(id) || activeSubSet.has(id);

      // Count non-failed digests per user (for cap check)
      const digestCountMap = new Map<string, number>();
      for (const row of digestRows ?? []) {
        const uid = row.user_id as string;
        digestCountMap.set(uid, (digestCountMap.get(uid) ?? 0) + 1);
      }

      const createdAtMap = new Map(rows.map((u) => [u.id, u.created_at ?? ""]));
      const trialWindowMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();

      return usersToFire.filter(({ user_id }) => {
        if (isPremium(user_id)) return true;

        // Non-premium: check trial window
        const accountAgeMs = nowMs - new Date(createdAtMap.get(user_id) ?? 0).getTime();
        if (accountAgeMs > trialWindowMs) return false; // expired

        // Check digest cap
        if ((digestCountMap.get(user_id) ?? 0) >= TRIAL_DIGEST_CAP) return false; // capped

        return true;
      });
    });

    if (trialApprovedUsers.length === 0) {
      return { fired: 0, message: "All due users are outside trial limits or already have digests" };
    }

    // ── Step 3: Fire digest/generate for each qualifying user ─────────────
    await step.run("fire-events", async () => {
      const periodEnd   = now.toISOString();
      const periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      await inngest.send(
        trialApprovedUsers.map(({ user_id }) => ({
          name: "digest/generate" as const,
          data: {
            user_id,
            trigger: "scheduled" as const,
            period_start: periodStart,
            period_end:   periodEnd,
          },
        }))
      );
    });

    return {
      fired:          trialApprovedUsers.length,
      skipped:        dueUsers.length - trialApprovedUsers.length,
      trialFiltered:  usersToFire.length - trialApprovedUsers.length,
      users:          trialApprovedUsers.map((u) => u.user_id),
    };
  }
);
