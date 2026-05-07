import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPricingConfig } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { isUserPremium } from "@/lib/audio/premium";
import { PricingCard } from "@/components/marketing/PricingCard";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

/** Features included in every plan. */
const FREE_FEATURES = [
  "Your own inbound address for newsletters",
  "Unlimited newsletter and RSS sources",
  "Daily or weekly digest — your schedule",
  "AI deduplication across all your sources",
  "Reply commands — ignore, save, get more",
  "Archive of all past digests",
  "No ads. No tracking. No noise.",
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
  const pricing = await getPricingConfig();

  // Resolve current user's plan state (best-effort — never throws)
  let isPremium = false;
  let isLoggedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      isLoggedIn = true;
      isPremium = await isUserPremium(user.id).catch(() => false);
    }
  } catch {
    // Unauthenticated or Supabase unavailable — show default CTAs
  }

  const displayPrice = pricing.deal_active
    ? pricing.deal_price_monthly
    : pricing.price_monthly;

  const proFeatures = [
    "Everything in the base plan",
    pricing.pro_description,
    `${pricing.pro_audio_limit} Audio Briefs per month`,
    "Priority support",
  ];

  return (
    <div className="max-w-4xl mx-auto px-6">

      {/* Header */}
      <section className="py-20 text-center space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          Simple, honest pricing
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          {pricing.pro_visible
            ? "Two plans. No hidden fees. Start free, no card required."
            : "One plan. Everything included. Start free, no card required."}
        </p>
      </section>

      {/* Cards */}
      <section className="flex justify-center pb-20">
        {pricing.pro_visible ? (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">

            {/* ── Base plan card ── */}
            <PricingCard
              planName="Free"
              price={`$${displayPrice}`}
              period="/month"
              subtitle={`${pricing.trial_days}-day free trial · cancel anytime`}
              badge={pricing.deal_active ? pricing.deal_label : undefined}
              strikeThroughPrice={
                pricing.deal_active ? `$${pricing.price_monthly}/month` : undefined
              }
              features={FREE_FEATURES}
              cta={
                isLoggedIn && !isPremium ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link href="/signup">
                      Start {pricing.trial_days}-day free trial
                    </Link>
                  </Button>
                )
              }
              finePrint="No credit card required."
            />

            {/* ── Pro card ── */}
            <PricingCard
              planName={pricing.pro_label}
              price={`$${pricing.pro_price_monthly}`}
              period="/month"
              subtitle="Includes everything in the base plan"
              badge="New"
              badgeVariant="outline"
              features={proFeatures}
              highlighted
              cta={
                isPremium ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90">
                    <Link href={isLoggedIn ? "/app/account#billing" : "/signup?plan=pro"}>
                      Upgrade to {pricing.pro_label}
                    </Link>
                  </Button>
                )
              }
              finePrint={isPremium ? "You're on Pro." : "No credit card required to start."}
            />

          </div>
        ) : (
          /* ── Single card layout ── */
          <div className="w-full max-w-md">
            <PricingCard
              planName="upto."
              price={`$${displayPrice}`}
              period="/month"
              subtitle={`${pricing.trial_days}-day free trial · cancel anytime`}
              badge={pricing.deal_active ? pricing.deal_label : undefined}
              strikeThroughPrice={
                pricing.deal_active ? `$${pricing.price_monthly}/month` : undefined
              }
              features={FREE_FEATURES}
              cta={
                isLoggedIn ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button asChild size="lg" className="w-full">
                    <Link href="/signup">
                      Start {pricing.trial_days}-day free trial
                    </Link>
                  </Button>
                )
              }
              finePrint="No credit card required to start."
              large
            />
          </div>
        )}
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

