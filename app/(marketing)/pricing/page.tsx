import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UpgradeButton } from "@/components/billing/UpgradeButton";
import { PricingCard } from "@/components/marketing/PricingCard";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

const PRO_FEATURES = [
  "Unlimited newsletters",
  "Unlimited RSS sources",
  "Daily or weekly briefs",
  "AI deduplication",
  "Reply commands",
  "Archive access",
];

const PREMIUM_FEATURES = [
  "Everything in Pro",
  "Audio Briefs",
  "Advanced digest controls",
  "Priority access to new features",
  "Future premium AI capabilities",
];

const FAQ = [
  {
    q: "What happens after the trial?",
    a: "You'll be asked to add a payment method. If you don't, your account stays in read-only mode — nothing is deleted.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account settings at any time. No questions asked.",
  },
  {
    q: "What counts as a source?",
    a: "Any newsletter forwarded to your inbound address, or any RSS feed you add. There's no limit.",
  },
];

export default async function PricingPage() {
  // Resolve current user's plan state (best-effort — never throws)
  let currentPlan: "free" | "pro" | "premium" = "free";
  let isLoggedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      isLoggedIn = true;
      const service = createServiceClient();
      const { data: subscription } = await service
        .from("subscriptions")
        .select("plan, status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (subscription?.status === "active" || subscription?.status === "trialing") {
        currentPlan = (subscription.plan as "free" | "pro" | "premium") ?? "free";
      }
    }
  } catch {
    // Unauthenticated or Supabase unavailable — show default CTAs
  }

  const trialNote = "3-day free trial. Card required. Cancel anytime.";

  return (
    <div className="max-w-4xl mx-auto px-6">

      {/* Header */}
      <section className="py-20 text-center space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          Simple, honest pricing
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Two plans. No hidden fees. {trialNote}
        </p>
      </section>

      {/* Cards */}
      <section className="flex justify-center pb-20">
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">

          {/* ── Pro card ── */}
          <PricingCard
            planName="Pro"
            price="$4.99"
            period="/month"
            subtitle={trialNote}
            strikeThroughPrice="$7.99/month"
            features={PRO_FEATURES}
            cta={
              currentPlan === "pro" || currentPlan === "premium" ? (
                <Button variant="outline" className="w-full" disabled>
                  {currentPlan === "pro" ? "Current plan" : "Included in Premium"}
                </Button>
              ) : isLoggedIn ? (
                <UpgradeButton plan="pro" className="w-full">
                  Upgrade to Pro
                </UpgradeButton>
              ) : (
                <Button asChild className="w-full">
                  <Link href="/signup?plan=pro">Start with Pro</Link>
                </Button>
              )
            }
            finePrint={currentPlan === "pro" ? "You're on Pro." : undefined}
          />

          {/* ── Premium card ── */}
          <PricingCard
            planName="Premium"
            price="$8.99"
            period="/month"
            subtitle={trialNote}
            badge="Best value"
            badgeVariant="outline"
            features={PREMIUM_FEATURES}
            highlighted
            cta={
              currentPlan === "premium" ? (
                <Button variant="outline" className="w-full" disabled>
                  Current plan
                </Button>
              ) : isLoggedIn ? (
                <UpgradeButton
                  plan="premium"
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  Upgrade to Premium
                </UpgradeButton>
              ) : (
                <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90">
                  <Link href="/signup?plan=premium">Start with Premium</Link>
                </Button>
              )
            }
            finePrint={currentPlan === "premium" ? "You're on Premium." : undefined}
          />

        </div>
      </section>

      {/* FAQ */}
      <section className="border-t py-20 space-y-8 max-w-lg mx-auto">
        <h2 className="text-xl font-semibold text-center">Questions</h2>
        <dl className="space-y-6">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="space-y-1">
              <dt className="text-sm font-medium">{q}</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

    </div>
  );
}
