import { NextRequest, NextResponse } from "next/server";

/**
 * POST /webhooks/stripe — Stripe event webhook.
 *
 * Handles:
 *   - checkout.session.completed  → create/activate subscription
 *   - customer.subscription.updated → update plan/status
 *   - customer.subscription.deleted → mark canceled
 *
 * TODO (Prompt 4): Implement full handler.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  // TODO: verify signature with Stripe.webhooks.constructEvent
  console.log("[stripe/webhook] received, signature present:", !!signature, "body length:", body.length);

  return NextResponse.json({ ok: true });
}
