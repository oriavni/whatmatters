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
            .select("id, timezone"),
        ]);

      if (prefsErr) throw new Error(`find-due-users prefs: ${prefsErr.message}`);
      if (usersErr) throw new Error(`find-due-users users: ${usersErr.message}`);

      // Build timezone lookup map
      const tzMap = new Map(
        (userRows ?? []).map((u) => [u.id, (u.timezone as string) || "UTC"])
      );

      return (prefs ?? []).filter((pref) => {
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

    // ── Step 3: Fire digest/generate for each qualifying user ─────────────
    await step.run("fire-events", async () => {
      const periodEnd   = now.toISOString();
      const periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      await inngest.send(
        usersToFire.map(({ user_id }) => ({
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
      fired:   usersToFire.length,
      skipped: dueUsers.length - usersToFire.length,
      users:   usersToFire.map((u) => u.user_id),
    };
  }
);
