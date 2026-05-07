import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import Link from "next/link";
import { OnboardingActions } from "@/components/onboarding/OnboardingActions";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("inbound_slug")
    .eq("id", user.id)
    .single();

  const inboundAddress = profile?.inbound_slug
    ? `${profile.inbound_slug}@${config.postmark.inboundDomain}`
    : `${user.id.replace(/-/g, "").slice(0, 16)}@${config.postmark.inboundDomain}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Welcome to upto.</h1>
          <p className="text-sm text-muted-foreground">
            Add at least one source and you&apos;re ready to generate your first Brief.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card divide-y">

          {/* Section 1 — RSS */}
          <div className="p-6 space-y-3">
            <div>
              <h2 className="text-sm font-medium">Add an RSS feed</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Paste any website URL — we&apos;ll detect the feed automatically.
              </p>
            </div>
            <OnboardingActions type="rss" />
          </div>

          {/* Section 2 — Newsletters */}
          <div className="p-6 space-y-3">
            <div>
              <h2 className="text-sm font-medium">Bring your newsletters</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Subscribe to any newsletter using this address, or forward
                newsletters you already receive. Issues land directly in your
                Brief — no inbox required.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Some senders require you to confirm the subscription from a
                confirmation email before issues start arriving.
              </p>
            </div>
            <OnboardingActions type="newsletter" inboundAddress={inboundAddress} />
          </div>

        </div>

        {/* Footer CTA */}
        <div className="text-center">
          <Link
            href="/app/brief"
            className={cn(buttonVariants({ variant: "default" }), "w-full")}
          >
            Go to my Brief →
          </Link>
          <p className="text-xs text-muted-foreground mt-2">
            You can always add more sources from the Sources page.
          </p>
        </div>

      </div>
    </div>
  );
}
