/**
 * POST /api/webhooks/creem
 *
 * Receives and processes Creem webhook events.
 *
 * Security:
 *   - Signature verified with HMAC-SHA256 before any DB writes
 *   - Always returns 200 to acknowledge (even for unknown events) so Creem
 *     doesn't retry unnecessarily
 *   - Returns 401 on bad signature so Creem logs the failure
 *
 * Handled events:
 *   checkout.completed          → activate subscription
 *   subscription.active         → mark active, refresh period
 *   subscription.paid           → refresh period dates
 *   subscription.trialing       → mark trialing
 *   subscription.canceled       → mark canceled
 *   subscription.scheduled_cancel → mark cancel_at_period_end=true (still active)
 *   subscription.past_due       → mark past_due
 *   subscription.expired        → mark canceled
 *   subscription.paused         → mark paused
 *   subscription.update         → sync status + period
 *
 * Webhook URL to register in Creem dashboard:
 *   https://<your-domain>/api/webhooks/creem
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyCreemWebhook, productIdToPlan } from "@/lib/billing/creem";
import type { CreemWebhookEvent } from "@/lib/billing/creem";
import {
  upsertSubscriptionForUser,
  patchSubscriptionByCreemId,
  resolveUserIdByEmail,
  mapCreemStatus,
  type InternalPlan,
} from "@/lib/billing/subscription";

// ─── Route config ─────────────────────────────────────────────────────────────

// Must read raw body for signature verification — disable body parsing
export const config = { api: { bodyParser: false } };

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Read raw body (required for HMAC verification)
  const rawBody = await request.text();

  // 2. Verify signature
  const signature = request.headers.get("creem-signature") ?? "";
  if (!signature || !verifyCreemWebhook(rawBody, signature)) {
    console.warn("[creem/webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse event
  let event: CreemWebhookEvent;
  try {
    event = JSON.parse(rawBody) as CreemWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`[creem/webhook] ${event.eventType} — event ${event.id}`);

  // 4. Dispatch
  try {
    const db = createServiceClient();
    await handleEvent(event, db);
  } catch (err) {
    // Log but still return 200 so Creem doesn't retry indefinitely.
    // Persistent failures will be visible in Creem's webhook logs.
    console.error("[creem/webhook] Handler error:", err);
  }

  return NextResponse.json({ ok: true });
}

// ─── Event dispatch ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEvent(event: CreemWebhookEvent, db: any) {
  const obj = event.object;

  switch (event.eventType) {
    // ── Checkout completed: first payment, provision access ──────────────────
    case "checkout.completed": {
      const metadata = obj.metadata ?? {};
      let userId: string | null = metadata.user_id ?? null;

      // Fall back to email lookup if metadata.user_id wasn't propagated
      if (!userId && obj.customer?.email) {
        userId = await resolveUserIdByEmail(obj.customer.email, db);
      }

      if (!userId) {
        console.warn("[creem/webhook] checkout.completed: cannot resolve user_id", {
          metadata,
          email: obj.customer?.email,
        });
        return;
      }

      // Determine plan from metadata (set at checkout creation) or product_id
      let plan: InternalPlan = (metadata.plan as InternalPlan) ?? "pro";
      if (obj.subscription && "product" in obj && (obj as { product?: { id: string } }).product?.id) {
        const fromProduct = productIdToPlan((obj as { product: { id: string } }).product.id);
        if (fromProduct) plan = fromProduct;
      }

      await upsertSubscriptionForUser(
        userId,
        {
          plan,
          status: "active",
          creem_customer_id: obj.customer?.id ?? null,
          creem_subscription_id: obj.subscription?.id ?? null,
        },
        db
      );
      break;
    }

    // ── Subscription active ──────────────────────────────────────────────────
    case "subscription.active": {
      const subId = obj.id;
      if (!subId) return;

      const plan = resolvePlanFromEvent(obj);

      const userId = await patchSubscriptionByCreemId(
        subId,
        {
          status: "active",
          ...(plan ? { plan } : {}),
          current_period_start: obj.current_period_start_date ?? null,
          current_period_end: obj.current_period_end_date ?? null,
          cancel_at_period_end: false,
          creem_customer_id: obj.customer?.id ?? null,
        },
        db
      );

      // If subscription row doesn't exist yet (race with checkout.completed),
      // create it via email lookup.
      if (!userId && obj.customer?.email) {
        const resolvedId = await resolveUserIdByEmail(obj.customer.email, db);
        if (resolvedId) {
          await upsertSubscriptionForUser(
            resolvedId,
            {
              plan: plan ?? "pro",
              status: "active",
              creem_customer_id: obj.customer.id ?? null,
              creem_subscription_id: subId,
              current_period_start: obj.current_period_start_date ?? null,
              current_period_end: obj.current_period_end_date ?? null,
            },
            db
          );
        }
      }
      break;
    }

    // ── Subscription paid: recurring payment, refresh period dates ───────────
    case "subscription.paid": {
      const subId = obj.id;
      if (!subId) return;
      await patchSubscriptionByCreemId(
        subId,
        {
          status: "active",
          current_period_start: obj.current_period_start_date ?? null,
          current_period_end: obj.current_period_end_date ?? null,
          cancel_at_period_end: false,
        },
        db
      );
      break;
    }

    // ── Subscription trialing ────────────────────────────────────────────────
    case "subscription.trialing": {
      const subId = obj.id;
      if (!subId) return;
      await patchSubscriptionByCreemId(
        subId,
        {
          status: "trialing",
          current_period_end: obj.current_period_end_date ?? null,
        },
        db
      );
      break;
    }

    // ── Subscription update (plan change, etc.) ──────────────────────────────
    case "subscription.update": {
      const subId = obj.id;
      if (!subId) return;
      const plan = resolvePlanFromEvent(obj);
      await patchSubscriptionByCreemId(
        subId,
        {
          ...(plan ? { plan } : {}),
          status: mapCreemStatus(obj.status ?? "active"),
          current_period_start: obj.current_period_start_date ?? null,
          current_period_end: obj.current_period_end_date ?? null,
        },
        db
      );
      break;
    }

    // ── Scheduled cancel: still active until period end ──────────────────────
    case "subscription.scheduled_cancel": {
      const subId = obj.id;
      if (!subId) return;
      await patchSubscriptionByCreemId(
        subId,
        {
          status: "active", // still active
          cancel_at_period_end: true,
          current_period_end: obj.current_period_end_date ?? null,
        },
        db
      );
      break;
    }

    // ── Subscription canceled (immediate) ────────────────────────────────────
    case "subscription.canceled": {
      const subId = obj.id;
      if (!subId) return;
      await patchSubscriptionByCreemId(
        subId,
        { status: "canceled", cancel_at_period_end: false },
        db
      );
      break;
    }

    // ── Subscription expired (billing period ended, no renewal) ─────────────
    case "subscription.expired": {
      const subId = obj.id;
      if (!subId) return;
      await patchSubscriptionByCreemId(
        subId,
        { status: "canceled" },
        db
      );
      break;
    }

    // ── Past due (payment failed, retrying) ──────────────────────────────────
    case "subscription.past_due": {
      const subId = obj.id;
      if (!subId) return;
      await patchSubscriptionByCreemId(
        subId,
        { status: "past_due" },
        db
      );
      break;
    }

    // ── Subscription paused ──────────────────────────────────────────────────
    case "subscription.paused": {
      const subId = obj.id;
      if (!subId) return;
      await patchSubscriptionByCreemId(
        subId,
        { status: "paused" },
        db
      );
      break;
    }

    // ── Unhandled events — acknowledge silently ──────────────────────────────
    default:
      console.log(`[creem/webhook] Unhandled event type: ${event.eventType}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolvePlanFromEvent(
  obj: CreemWebhookEvent["object"]
): InternalPlan | null {
  const productId = obj.product?.id;
  if (!productId) return null;
  return productIdToPlan(productId);
}
