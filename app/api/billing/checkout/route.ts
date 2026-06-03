/**
 * POST /api/billing/checkout
 *
 * Creates a Creem checkout session and returns the redirect URL.
 *
 * Body: { plan: "pro" | "premium" }
 * Response: { url: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCreemCheckout } from "@/lib/billing/creem";
import { config } from "@/lib/config";
import type { CreemPlan } from "@/lib/billing/creem";

const VALID_PLANS: CreemPlan[] = ["pro", "premium"];

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
  let plan: CreemPlan;
  try {
    const body = await request.json();
    plan = body?.plan;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}` },
      { status: 400 }
    );
  }

  // ── Create Creem checkout ──────────────────────────────────────────────────
  const successUrl = `${config.app.url}/app/account?upgraded=${plan}`;

  try {
    const checkoutUrl = await createCreemCheckout({
      plan,
      userId: user.id,
      userEmail: user.email ?? "",
      successUrl,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout creation failed";
    console.error("[billing/checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
