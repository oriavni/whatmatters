/**
 * POST /api/billing/portal
 *
 * Returns a URL for the Creem customer portal (manage billing / cancel).
 * Creem's portal URL is constructed from the customer ID stored in the DB.
 *
 * Response: { url: string }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("creem_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = (sub as { creem_customer_id?: string | null } | null)
    ?.creem_customer_id;

  if (!customerId) {
    // No Creem subscription on file — send them to the pricing page
    return NextResponse.json({ url: `${config.app.url}/pricing` });
  }

  // In test mode, Creem's live portal doesn't work for test customers.
  // Redirect to the pricing page with a notice instead.
  if (config.creem.testMode) {
    return NextResponse.json({ url: `${config.app.url}/pricing?billing=test-mode` });
  }

  // Creem portal URL: https://www.creem.io/portal/<customerId>
  const portalUrl = `https://www.creem.io/portal/${customerId}`;
  return NextResponse.json({ url: portalUrl });
}
