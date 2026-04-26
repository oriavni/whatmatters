import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { config } from "@/lib/config";

/** GET /api/preferences — returns user preferences + inbound address */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const [prefsResult, userResult] = await Promise.all([
    service
      .from("user_preferences")
      .select("digest_frequency, digest_time, digest_day")
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .from("users")
      .select("inbound_slug, timezone")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const prefs = prefsResult.data;
  const inboundSlug = userResult.data?.inbound_slug ?? null;
  const inboundAddress = inboundSlug
    ? `${inboundSlug}@${config.postmark.inboundDomain}`
    : null;

  return NextResponse.json({
    digest_frequency: prefs?.digest_frequency ?? "daily",
    digest_time: prefs?.digest_time ?? "08:00",
    digest_day: prefs?.digest_day ?? 1,
    timezone: userResult.data?.timezone ?? "UTC",
    inbound_address: inboundAddress,
  });
}

/** PATCH /api/preferences — update delivery schedule and/or timezone */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    digest_frequency?: string;
    digest_time?: string;
    digest_day?: number;
    timezone?: string;
  };

  const allowedFreqs = ["daily", "weekly", "off"];
  if (body.digest_frequency && !allowedFreqs.includes(body.digest_frequency)) {
    return NextResponse.json({ error: "Invalid digest_frequency" }, { status: 400 });
  }

  // Basic IANA timezone validation — must contain no spaces and at least one "/"
  // (or be exactly "UTC"). Prevents arbitrary string injection.
  if (body.timezone !== undefined) {
    const tz = body.timezone;
    if (tz !== "UTC" && (tz.includes(" ") || !tz.includes("/"))) {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }
  }

  const service = createServiceClient();

  // Preferences (digest_frequency, digest_time, digest_day) → user_preferences
  const hasPrefsChange =
    body.digest_frequency !== undefined ||
    body.digest_time !== undefined ||
    body.digest_day !== undefined;

  if (hasPrefsChange) {
    const { error } = await service
      .from("user_preferences")
      .upsert(
        {
          user_id: user.id,
          ...(body.digest_frequency !== undefined && { digest_frequency: body.digest_frequency }),
          ...(body.digest_time !== undefined && { digest_time: body.digest_time }),
          ...(body.digest_day !== undefined && { digest_day: body.digest_day }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.timezone !== undefined) {
    const { error } = await service
      .from("users")
      .update({ timezone: body.timezone, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
