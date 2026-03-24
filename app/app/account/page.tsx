import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyAddressButton } from "@/components/account/CopyAddressButton";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("users").select("inbound_slug").eq("id", user.id).single(),
    supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single(),
  ]);

  const inboundAddress = profile?.inbound_slug
    ? `${profile.inbound_slug}@${config.postmark.inboundDomain}`
    : `${user.id.replace(/-/g, "").slice(0, 16)}@${config.postmark.inboundDomain}`;

  const plan = subscription?.plan ?? "free";

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
              ? "Up to 5 sources · Daily digests"
              : "Unlimited sources · All features"}
          </span>
        </div>
        {plan === "free" && (
          <Button variant="outline" size="sm">
            Upgrade to Pro
          </Button>
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
        <Button variant="destructive" size="sm" disabled>
          Delete account
        </Button>
        <p className="text-xs text-muted-foreground">
          Account deletion is not yet available. Contact support.
        </p>
      </section>
    </div>
  );
}
