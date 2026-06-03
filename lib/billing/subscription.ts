/**
 * lib/billing/subscription.ts — Database helpers for subscription management.
 *
 * Used by the Creem webhook handler and billing API routes.
 * SERVER-ONLY.
 */
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InternalPlan = "free" | "pro" | "premium";
export type InternalStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused";

export interface SubscriptionUpsertData {
  plan: InternalPlan;
  status: InternalStatus;
  creem_customer_id?: string | null;
  creem_subscription_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

// ─── Upsert by userId ─────────────────────────────────────────────────────────

/**
 * Create or update the subscription row for a given user.
 * Safe to call from webhooks — uses service client for full DB access.
 */
export async function upsertSubscriptionForUser(
  userId: string,
  data: SubscriptionUpsertData,
  service?: SupabaseClient
): Promise<void> {
  const db = service ?? createServiceClient();

  const { error } = await db.from("subscriptions").upsert(
    {
      user_id: userId,
      plan: data.plan,
      status: data.status,
      creem_customer_id: data.creem_customer_id ?? null,
      creem_subscription_id: data.creem_subscription_id ?? null,
      current_period_start: data.current_period_start ?? null,
      current_period_end: data.current_period_end ?? null,
      cancel_at_period_end: data.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`[subscription] upsert failed for user ${userId}: ${error.message}`);
  }
}

// ─── Update by Creem subscription ID ─────────────────────────────────────────

export interface SubscriptionPatchData {
  status?: InternalStatus;
  plan?: InternalPlan;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  creem_customer_id?: string | null;
}

/**
 * Patch an existing subscription row by creem_subscription_id.
 * Used by subscription lifecycle webhook events (paid, canceled, past_due, etc.).
 * Returns the user_id of the updated row, or null if not found.
 */
export async function patchSubscriptionByCreemId(
  creemSubscriptionId: string,
  data: SubscriptionPatchData,
  service?: SupabaseClient
): Promise<string | null> {
  const db = service ?? createServiceClient();

  // Build update payload (only include defined keys)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.status !== undefined) patch.status = data.status;
  if (data.plan !== undefined) patch.plan = data.plan;
  if (data.current_period_start !== undefined) patch.current_period_start = data.current_period_start;
  if (data.current_period_end !== undefined) patch.current_period_end = data.current_period_end;
  if (data.cancel_at_period_end !== undefined) patch.cancel_at_period_end = data.cancel_at_period_end;
  if (data.creem_customer_id !== undefined) patch.creem_customer_id = data.creem_customer_id;

  const { data: rows, error } = await db
    .from("subscriptions")
    .update(patch)
    .eq("creem_subscription_id", creemSubscriptionId)
    .select("user_id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `[subscription] patch failed for creem_subscription_id ${creemSubscriptionId}: ${error.message}`
    );
  }

  return (rows as { user_id: string } | null)?.user_id ?? null;
}

// ─── Look up userId by email ──────────────────────────────────────────────────

/**
 * Resolve a Creem customer email to an internal user_id.
 * Falls back to auth.users lookup when the creem_customer_id isn't cached yet.
 */
export async function resolveUserIdByEmail(
  email: string,
  service?: SupabaseClient
): Promise<string | null> {
  const db = service ?? createServiceClient();

  // auth.users is accessible via the service client
  const { data, error } = await db.auth.admin.listUsers();
  if (error) return null;

  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  return match?.id ?? null;
}

// ─── Map Creem status → internal status ──────────────────────────────────────

export function mapCreemStatus(creemStatus: string): InternalStatus {
  switch (creemStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "canceled":
    case "expired":
    case "scheduled_cancel": // subscription still active until period end; handled separately
      return "canceled";
    default:
      return "active";
  }
}
