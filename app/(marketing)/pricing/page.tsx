import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { getPricingConfig } from "@/lib/pricing";

export const metadata: Metadata = { title: "Pricing — WhatMatters" };
export const dynamic = "force-dynamic";

const FEATURES = [
  "Your own inbound email address for newsletters",
  "Unlimited newsletter and RSS sources",
  "Daily or weekly digest — your schedule, your time",
  "AI deduplication across all your sources",
  "Reply commands — ignore, save, get more on any topic",
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
  const displayPrice = pricing.deal_active ? pricing.deal_price_monthly : pricing.price_monthly;

  /** Features shown in the Pro card. */
  const PRO_FEATURES = [
    "Everything in the free plan",
    pricing.pro_description,
    `${pricing.pro_audio_limit} Audio Briefs per month`,
    "Priority support",
  ];

  return (
    <div className="max-w-4xl mx-auto px-6">

      {/* Header */}
      <section className="py-20 text-center space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Simple, honest pricing</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          {pricing.pro_visible
            ? "Two plans. No hidden fees. Start free, no card required."
            : "One plan. Everything included. Start free, no card required."}
        </p>
      </section>

      {/* Pricing card(s) */}
      <section className="flex justify-center pb-20">
        {pricing.pro_visible ? (
          /* ── Two-column layout when Pro is enabled ── */
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">

            {/* Free / Basic card */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2 space-y-3">
                {pricing.deal_active && (
                  <div className="space-y-1">
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                      {pricing.deal_label}
                    </Badge>
                    {pricing.deal_slots_remaining > 0 && (
                      <p className="text-xs text-muted-foreground pl-1">
                        {pricing.deal_slots_remaining} of {pricing.deal_slots_total} spots remaining
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Free</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-semibold">${displayPrice}</span>
                    <span className="text-muted-foreground mb-1">/month</span>
                  </div>
                  {pricing.deal_active && (
                    <p className="text-xs text-muted-foreground">
                      Regular price: <span className="line-through">${pricing.price_monthly}/month</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {pricing.trial_days}-day free trial · cancel anytime
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-6 pt-2">
                <ul className="space-y-2.5 flex-1">
                  {FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className="shrink-0 mt-0.5 text-foreground">✓</span>
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Link
                    href="/signup"
                    className={cn(buttonVariants({ size: "default" }), "w-full text-center")}
                  >
                    Start {pricing.trial_days}-day free trial
                  </Link>
                  <p className="text-xs text-center text-muted-foreground">
                    No credit card required.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Pro card */}
            <Card className="flex flex-col border-foreground/20 shadow-md" id="pro">
              <CardHeader className="pb-2 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-muted-foreground">{pricing.pro_label}</p>
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                      New
                    </Badge>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-semibold">${pricing.pro_price_monthly}</span>
                    <span className="text-muted-foreground mb-1">/month</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Includes everything in the free plan
                  </p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-6 pt-2">
                <ul className="space-y-2.5 flex-1">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className="shrink-0 mt-0.5 text-foreground">✓</span>
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Link
                    href="/signup?plan=pro"
                    className="inline-flex items-center justify-center w-full rounded-md bg-foreground text-background text-sm font-medium h-9 px-4"
                  >
                    Upgrade to {pricing.pro_label}
                  </Link>
                  <p className="text-xs text-center text-muted-foreground">
                    No credit card required to start.
                  </p>
                </div>
              </CardContent>
            </Card>

          </div>
        ) : (
          /* ── Single card layout (default) ── */
          <div className="w-full max-w-md rounded-xl border bg-card p-8 space-y-8">

            {pricing.deal_active && (
              <div className="space-y-1">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                  {pricing.deal_label}
                </Badge>
                {pricing.deal_slots_remaining > 0 && (
                  <p className="text-xs text-muted-foreground pl-1">
                    {pricing.deal_slots_remaining} of {pricing.deal_slots_total} spots remaining
                  </p>
                )}
              </div>
            )}

            {/* Price */}
            <div className="space-y-1">
              <div className="flex items-end gap-1">
                <span className="text-5xl font-semibold">${displayPrice}</span>
                <span className="text-muted-foreground mb-1.5">/month</span>
              </div>
              {pricing.deal_active && (
                <p className="text-sm text-muted-foreground">
                  Regular price: <span className="line-through">${pricing.price_monthly}/month</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {pricing.trial_days}-day free trial · cancel anytime
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 mt-0.5 text-foreground">✓</span>
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="space-y-3">
              <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "w-full text-center")}>
                Start {pricing.trial_days}-day free trial
              </Link>
              <p className="text-xs text-center text-muted-foreground">
                No credit card required to start.
              </p>
            </div>
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
