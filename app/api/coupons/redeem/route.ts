/**
 * POST /api/coupons/redeem
 *
 * User-facing coupon redemption.
 *
 * Body: { code: string }
 *
 * Behavior by access_type:
 *   - "free"     → grants the coupon's plan directly (status "active",
 *                  no Creem checkout, no charge — for testers/friends/family)
 *   - "discount" → does NOT grant a plan. Returns the discount percentage so
 *                  the client can pass it through to the Creem checkout flow.
 *                  (Wiring this into createCreemCheckout is a follow-up —
 *                  see note below.)
 *
 * All validation (active, not expired, redemption limits, one-per-user) is
 * enforced server-side here — never trust client state.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { upsertSubscriptionForUser } from "@/lib/billing/subscription";

export async function POST(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Validate body ──────────────────────────────────────────────────────────
  let rawCode: string | undefined;
  try {
    const body = await request.json();
    rawCode = body?.code;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = rawCode?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
  }

  const db = createServiceClient();

  // ── Look up coupon ─────────────────────────────────────────────────────────
  const { data: coupon, error: lookupError } = await db
    .from("coupon_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!coupon) {
    return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
  }
  if (!coupon.is_active) {
    return NextResponse.json({ error: "This coupon is no longer active" }, { status: 410 });
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This coupon has expired" }, { status: 410 });
  }
  if (coupon.max_redemptions != null && coupon.redemptions_count >= coupon.max_redemptions) {
    return NextResponse.json({ error: "This coupon has reached its redemption limit" }, { status: 410 });
  }

  // ── Enforce one redemption per user (unique constraint is the real guard;
  //    this pre-check just gives a friendlier error message) ─────────────────
  const { data: existing } = await db
    .from("coupon_redemptions")
    .select("id")
    .eq("coupon_id", coupon.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You've already redeemed this coupon" }, { status: 409 });
  }

  // ── Record the redemption first (unique constraint prevents races/double-spend) ─
  const { error: redemptionError } = await db.from("coupon_redemptions").insert({
    coupon_id: coupon.id,
    user_id: user.id,
  });

  if (redemptionError) {
    if (redemptionError.code === "23505") {
      return NextResponse.json({ error: "You've already redeemed this coupon" }, { status: 409 });
    }
    return NextResponse.json({ error: redemptionError.message }, { status: 500 });
  }

  // ── Bump the redemption counter (best-effort; redemption row is source of truth) ─
  await db
    .from("coupon_codes")
    .update({ redemptions_count: coupon.redemptions_count + 1 })
    .eq("id", coupon.id);

  // ── Apply the coupon's effect ──────────────────────────────────────────────
  if (coupon.access_type === "free") {
    await upsertSubscriptionForUser(
      user.id,
      {
        plan: coupon.plan_granted,
        status: "active",
        // No Creem identifiers — this is a comped account, not a paid one.
        // Existing Creem fields (if any) are intentionally left untouched by
        // upsertSubscriptionForUser's onConflict merge.
      },
      db
    );

    return NextResponse.json({
      ok: true,
      type: "free",
      plan: coupon.plan_granted,
      message: `You now have free access to ${coupon.plan_granted === "premium" ? "Premium" : "Pro"}.`,
    });
  }

  // access_type === "discount" — don't grant a plan; hand back the discount
  // so the client can route the user into checkout with it applied.
  // NOTE: createCreemCheckout doesn't currently accept a discount parameter —
  // wiring that through is a small follow-up once you confirm how Creem wants
  // discounts passed at session-creation time (likely a `discount_code` or
  // `discount_id` field once the API key has the `discounts` scope).
  return NextResponse.json({
    ok: true,
    type: "discount",
    plan: coupon.plan_granted,
    discount_percent: coupon.discount_percent,
    message: `Coupon applied — ${coupon.discount_percent}% off ${coupon.plan_granted === "premium" ? "Premium" : "Pro"}. Continue to checkout to use it.`,
  });
}
