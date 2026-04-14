import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const steps = [
  {
    step: "01",
    title: "Route your sources",
    body: "Subscribe to newsletters with your dedicated Brief address, or add RSS feeds. Forward existing newsletters from Gmail.",
  },
  {
    step: "02",
    title: "We read everything",
    body: "WhatMatters reads every item, detects overlapping topics, and compresses repetition — without losing breadth.",
  },
  {
    step: "03",
    title: "Receive your Brief",
    body: "Get a beautiful editorial digest on your schedule. Reply to it to teach the system. Never open the app if you prefer.",
  },
];

export default function LandingPage() {
  return (
    <div className="max-w-4xl mx-auto px-6">
      {/* Hero */}
      <section className="py-24 text-center space-y-6">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          Private intelligence for your inbox
        </Badge>
        <h1 className="text-5xl font-semibold tracking-tight leading-tight max-w-3xl mx-auto">
          Everything you should read.
          <br />
          <span className="text-muted-foreground">
            Nothing you need to read twice.
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Route your newsletters and RSS feeds to WhatMatters. We read
          everything, compress the overlap, and deliver a single editorial
          briefing — every morning.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }))}>
            Start your free Brief
          </Link>
          <Link
            href="#how-it-works"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            See how it works
          </Link>
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
