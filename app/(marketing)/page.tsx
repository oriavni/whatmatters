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

const TRIAL_NOTE = "3-day free trial. Card required. Cancel anytime.";

export default async function LandingPage() {
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

      {/* Demo Video */}
      <section className="py-20 border-t space-y-8">
        <p className="text-xs font-medium text-center text-muted-foreground tracking-widest uppercase">
          See it in action
        </p>
        <div className="w-4/5 mx-auto rounded-2xl overflow-hidden bg-black">
          <div className="aspect-video">
            <iframe
              src="https://player.vimeo.com/video/1190277988?h=faa34e9141&badge=0&title=0&byline=0&portrait=0&autopause=0&autoplay=1&muted=1&loop=1"
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
              allowFullScreen
              title="upto — see it in action"
              style={{ border: "none" }}
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 border-t space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Simple pricing</h2>
          <p className="text-muted-foreground text-sm">
            Two plans. No hidden fees. {TRIAL_NOTE}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <PricingCard
            planName="Pro"
            price="$4.99"
            period="/month"
            subtitle={TRIAL_NOTE}
            strikeThroughPrice="$7.99/month"
            features={PRO_FEATURES}
            cta={
              <Button asChild className="w-full">
                <Link href="/signup?plan=pro">Start with Pro</Link>
              </Button>
            }
          />

          <PricingCard
            planName="Premium"
            price="$8.99"
            period="/month"
            subtitle={TRIAL_NOTE}
            badge="Best value"
            badgeVariant="outline"
            features={PREMIUM_FEATURES}
            highlighted
            cta={
              <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90">
                <Link href="/signup?plan=premium">Start with Premium</Link>
              </Button>
            }
          />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t text-center space-y-5">
        <h2 className="text-2xl font-semibold">
          Your private briefing starts today.
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          {TRIAL_NOTE}
        </p>
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
          Get started free
        </Link>
      </section>
    </div>
  );
}
