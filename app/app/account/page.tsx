import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CopyAddressButton } from "@/components/account/CopyAddressButton";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { UpgradeButton } from "@/components/billing/UpgradeButton";
import { ManageBillingButton } from "@/components/billing/ManageBillingButton";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("users").select("inbound_slug").eq("id", user.id).single(),
    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const inboundAddress = profile?.inbound_slug
    ? `${profile.inbound_slug}@${config.postmark.inboundDomain}`
    : `${user.id.replace(/-/g, "").slice(0, 16)}@${config.postmark.inboundDomain}`;

  const plan = subscription?.plan ?? "free";
  const isActivePaidPlan = plan !== "free" && subscription?.status === "active";

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Account" description="Manage your account and billing." />

      <Separator />

      {/* Identity */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Signed in as</h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </section>

      <Separator />

      {/* Plan */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Current plan</h2>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="capitalize">
            {plan}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {plan === "free"
              ? "Free trial · limited features"
              : plan === "premium"
              ? "Unlimited sources · Audio Briefs · All features"
              : "Unlimited sources · All features"}
          </span>
        </div>
        {plan === "free" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <UpgradeButton plan="pro" variant="outline" size="sm">
              Upgrade to Pro — $4.99/mo
            </UpgradeButton>
            <UpgradeButton plan="premium" size="sm">
              Upgrade to Premium — $8.99/mo
            </UpgradeButton>
          </div>
        )}
        {plan === "pro" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <UpgradeButton plan="premium" size="sm">
              Upgrade to Premium — $8.99/mo
            </UpgradeButton>
            {isActivePaidPlan && (
              <ManageBillingButton variant="outline" size="sm" />
            )}
          </div>
        )}
        {plan === "premium" && isActivePaidPlan && (
          <ManageBillingButton variant="outline" size="sm" />
        )}
      </section>

      <Separator />

      {/* Inbound address */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Your Brief address</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Subscribe to any newsletter with this address and it will appear in
            your Brief automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-sm bg-muted px-3 py-2 rounded-md flex-1 truncate font-mono">
            {inboundAddress}
          </code>
          <CopyAddressButton address={inboundAddress} />
        </div>
      </section>

      <Separator />

      {/* Danger zone */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="text-xs text-muted-foreground">
          Deactivating your account immediately freezes it — no more Briefs,
          emails, or AI processing. Your data is retained and the action can be
          reversed by contacting support.
        </p>
        <DeleteAccountButton email={user.email ?? ""} />
      </section>
    </div>
  );
}
