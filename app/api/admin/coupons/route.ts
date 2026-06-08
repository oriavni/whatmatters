/**
 * /api/admin/coupons
 *
 * Admin CRUD for coupon codes (discount or free-access grants).
 *
 * GET    → list all coupons + redemption counts
 * POST   → create a coupon
 * PATCH  → update a coupon (e.g. toggle is_active, change expiry/max)
 * DELETE → remove a coupon (?id=...)
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/service";

function isAuthorized(request: NextRequest): boolean {
  const token = request.cookies.get("admin_token")?.value;
  return !!token && token === config.admin.secret;
}

const VALID_PLANS = ["pro", "premium"];
const VALID_ACCESS_TYPES = ["discount", "free"];

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("coupon_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    code?: string;
    plan_granted?: string;
    access_type?: string;
    discount_percent?: number | null;
    max_redemptions?: number | null;
    expires_at?: string | null;
    note?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  const { plan_granted, access_type, discount_percent, max_redemptions, expires_at, note } = body;

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }
  if (!plan_granted || !VALID_PLANS.includes(plan_granted)) {
    return NextResponse.json({ error: `plan_granted must be one of: ${VALID_PLANS.join(", ")}` }, { status: 400 });
  }
  if (!access_type || !VALID_ACCESS_TYPES.includes(access_type)) {
    return NextResponse.json({ error: `access_type must be one of: ${VALID_ACCESS_TYPES.join(", ")}` }, { status: 400 });
  }
  if (access_type === "discount") {
    if (
      discount_percent == null ||
      typeof discount_percent !== "number" ||
      discount_percent <= 0 ||
      discount_percent > 100
    ) {
      return NextResponse.json(
        { error: "discount_percent must be a number between 1 and 100 for discount codes" },
        { status: 400 }
      );
    }
  }
  if (access_type === "free" && discount_percent != null) {
    return NextResponse.json(
      { error: "discount_percent must be omitted for free-access codes" },
      { status: 400 }
    );
  }
  if (max_redemptions != null && (typeof max_redemptions !== "number" || max_redemptions <= 0)) {
    return NextResponse.json({ error: "max_redemptions must be a positive number or null (unlimited)" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("coupon_codes")
    .insert({
      code,
      plan_granted: plan_granted as "pro" | "premium",
      access_type: access_type as "discount" | "free",
      discount_percent: access_type === "discount" ? (discount_percent as number) : null,
      max_redemptions: max_redemptions ?? null,
      expires_at: expires_at || null,
      note: note?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `Code "${code}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ coupon: data });
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    id?: string;
    is_active?: boolean;
    max_redemptions?: number | null;
    expires_at?: string | null;
    note?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, ...rest } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Only allow a known, safe subset of fields to be patched.
  const patch: Record<string, unknown> = {};
  if (typeof rest.is_active === "boolean") patch.is_active = rest.is_active;
  if (rest.max_redemptions !== undefined) patch.max_redemptions = rest.max_redemptions;
  if (rest.expires_at !== undefined) patch.expires_at = rest.expires_at || null;
  if (rest.note !== undefined) patch.note = rest.note?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("coupon_codes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ coupon: data });
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("coupon_codes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
