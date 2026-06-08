/**
 * lib/billing/creem.ts — Creem API client and webhook utilities.
 *
 * SERVER-ONLY. Never import from client components or browser bundles.
 *
 * Creem API docs: https://docs.creem.io
 */
import crypto from "crypto";
import { config } from "@/lib/config";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreemPlan = "pro" | "premium";

export interface CreemCheckoutOptions {
  /** Internal plan slug — determines which Creem product to charge for */
  plan: CreemPlan;
  userId: string;
  userEmail: string;
  /** URL to redirect the customer after successful payment */
  successUrl: string;
}

export interface CreemCustomer {
  id: string;
  email: string;
  name?: string;
  country?: string;
}

export interface CreemSubscription {
  id: string;
  status: string;
  current_period_start_date?: string;
  current_period_end_date?: string;
  canceled_at?: string;
  metadata?: Record<string, string>;
  customer?: CreemCustomer;
  product?: { id: string; name: string };
}

export interface CreemWebhookEvent {
  id: string;
  eventType: string;
  created_at: number;
  object: {
    // checkout.completed
    id?: string;
    status?: string;
    metadata?: Record<string, string>;
    customer?: CreemCustomer;
    subscription?: { id: string; status: string };
    // subscription.*
    current_period_start_date?: string;
    current_period_end_date?: string;
    canceled_at?: string;
    product?: { id: string; name: string };
  };
}

// ─── Plan → Product ID mapping ────────────────────────────────────────────────

export function planToProductId(plan: CreemPlan): string {
  const id =
    plan === "pro"
      ? config.creem.products.proId
      : config.creem.products.premiumId;

  if (!id) {
    throw new Error(
      `[creem] Missing product ID for plan "${plan}". ` +
        `Set CREEM_${plan.toUpperCase()}_PRODUCT_ID in your environment.`
    );
  }
  return id;
}

export function productIdToPlan(productId: string): CreemPlan | null {
  if (productId && productId === config.creem.products.proId) return "pro";
  if (productId && productId === config.creem.products.premiumId) return "premium";
  return null;
}

// ─── Checkout session creation ────────────────────────────────────────────────

/**
 * Create a Creem checkout session and return the redirect URL.
 *
 * The `metadata.user_id` and `metadata.plan` fields are used by the webhook
 * handler to match the payment to an internal user without relying on
 * customer email (which could mismatch if the user pays with a different email).
 */
export async function createCreemCheckout(
  opts: CreemCheckoutOptions
): Promise<string> {
  const productId = planToProductId(opts.plan);

  const body = {
    product_id: productId,
    success_url: opts.successUrl,
    customer: { email: opts.userEmail },
    metadata: {
      user_id: opts.userId,
      plan: opts.plan,
    },
  };

  const res = await fetch(`${config.creem.apiBase}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.creem.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new Error(
      `[creem] Checkout creation failed: ${res.status} ${res.statusText} — ${text} ` +
        `(debug: sent product_id="${productId}" to ${config.creem.apiBase}, testMode=${config.creem.testMode})`
    );
  }

  const data = (await res.json()) as { checkout_url: string };
  if (!data.checkout_url) {
    throw new Error("[creem] Response missing checkout_url");
  }
  return data.checkout_url;
}

// ─── Webhook signature verification ──────────────────────────────────────────

/**
 * Verify the HMAC-SHA256 signature in the `creem-signature` header.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 * Returns false (not throws) on any mismatch or malformed input so callers
 * can return a clean 401 without leaking stack traces.
 */
export function verifyCreemWebhook(
  rawBody: string,
  signature: string
): boolean {
  try {
    const secret = config.creem.webhookSecret;
    const computed = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // Both buffers must be the same byte length for timingSafeEqual
    const computedBuf = Buffer.from(computed, "hex");
    const signatureBuf = Buffer.from(signature, "hex");

    if (computedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, signatureBuf);
  } catch {
    return false;
  }
}
