import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { getPricingConfig } from "@/lib/pricing";
import { PricingCard } from "@/components/marketing/PricingCard";

export const dynamic = "force-dynamic"; // pricing data must always be fresh

const steps = [
  {
    step: "01",
    title: "Route your sources",
    body: "Subscribe to newsletters with your dedicated Brief address, or add RSS feeds. Forward existing newsletters from Gmail.",
  },
  {
    step: "02",
    title: "We read everything",
    body: "upto reads every item, detects overlapping topics, and compresses repetition — without losing breadth.",
  },
  {
    step: "03",
    title: "Receive your Brief",
    body: "Get a beautiful editorial digest on your schedule. Reply to it to teach the system. Never open the app if you prefer.",
  },
];

const FREE_FEATURES = [
  "Your own inbound email address",
  "Unlimited newsletter sources",
  "Daily or weekly digest, on your schedule",
  "Reply to teach — ignore, save, or get more on any topic",
  "No ads, no tracking",
];

export default async function LandingPage() {
  const pricing = await getPricingConfig();

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
      {/* Hero */}
      <section className="py-24 text-center space-y-6">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          Private intelligence for your inbox
        </Badge>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-tight max-w-3xl mx-auto">
          Everything you should read.
          <br />
          <span className="text-muted-foreground">
            Nothing you need to read twice.
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Route your newsletters and RSS feeds to upto. We read
          everything, compress the overlap, and deliver a single editorial
          briefing — every morning.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
            Start your free Brief
          </Link>
          <a
            href="#how-it-works"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}
          >
            See how it works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 border-t">
        <h2 className="text-2xl font-semibold text-center mb-10">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((item) => (
            <Card key={item.step}>
              <CardHeader>
                <span className="text-xs font-mono text-muted-foreground mb-1">
                  {item.step}
                </span>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed">
                  {item.body}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 border-t space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Simple pricing</h2>
          <p className="text-muted-foreground text-sm">
            {pricing.pro_visible
              ? "Two plans. No hidden fees. Start free, no card required."
              : `${pricing.trial_days}-day free trial. No credit card required.`}
          </p>
        </div>

        {pricing.pro_visible ? (
          /* ── Two-column: Free + Pro ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
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
                <Button asChild className="w-full">
                  <Link href="/signup">
                    Start {pricing.trial_days}-day free trial
                  </Link>
                </Button>
              }
              finePrint="No credit card required."
            />

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
                <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90">
                  <Link href="/signup?plan=pro">
                    Upgrade to {pricing.pro_label}
                  </Link>
                </Button>
              }
              finePrint="No credit card required to start."
            />
          </div>
        ) : (
          /* ── Single card (default) ── */
          <div className="max-w-md mx-auto">
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
                <Button asChild size="lg" className="w-full">
                  <Link href="/signup">
                    Start {pricing.trial_days}-day free trial
                  </Link>
                </Button>
              }
              finePrint="No credit card required to start."
              large
            />
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="py-20 border-t text-center space-y-5">
        <h2 className="text-2xl font-semibold">
          Your private briefing starts today.
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Free to start. No credit card required.
        </p>
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
          Get started free
        </Link>
      </section>
    </div>
  );
}
