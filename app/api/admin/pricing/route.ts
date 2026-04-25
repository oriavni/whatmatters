import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/service";

function isAuthorized(request: NextRequest): boolean {
  const token = request.cookies.get("admin_token")?.value;
  return !!token && token === config.admin.secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("pricing_config")
    .select("*")
    .eq("id", "default")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Whitelist allowed fields (includes pro plan columns added in migration 20260425000001)
  const allowed = [
    "price_monthly",
    "trial_days",
    "deal_active",
    "deal_label",
    "deal_price_monthly",
    "deal_slots_total",
    "deal_slots_remaining",
    "pro_visible",
    "pro_price_monthly",
    "pro_label",
    "pro_audio_limit",
    "pro_description",
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("pricing_config")
    .update(updates)
    .eq("id", "default");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
