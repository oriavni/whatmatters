import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { PageHeader } from "@/components/layout/PageHeader";
import { Separator } from "@/components/ui/separator";
import { InboundAddressCard } from "@/components/onboarding/InboundAddressCard";
import { DeliveryScheduleForm } from "@/components/preferences/DeliveryScheduleForm";
import { IgnoredTopicsList } from "@/components/preferences/IgnoredTopicsList";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  const [prefsResult, userResult, suppressionsResult] = await Promise.all([
    service
      .from("user_preferences")
      .select("digest_frequency, digest_time, digest_day")
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .from("users")
      .select("inbound_slug, timezone")
      .eq("id", user.id)
      .maybeSingle(),
    service
      .from("topic_suppressions")
      .select("topic, suppress_level, digests_remaining")
      .eq("user_id", user.id)
      .gt("digests_remaining", 0)
      .order("updated_at", { ascending: false }),
  ]);

  const prefs = prefsResult.data;
  const inboundSlug = userResult.data?.inbound_slug ?? null;
  const timezone    = userResult.data?.timezone ?? "UTC";
  const inboundAddress = inboundSlug
    ? `${inboundSlug}@${config.postmark.inboundDomain}`
    : null;

  const suppressions = (suppressionsResult.data ?? []).map((s) => ({
    topic: s.topic as string,
    suppress_level: s.suppress_level as number,
    digests_remaining: s.digests_remaining as number,
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Preferences"
        description="Control how and when you receive your Brief."
      />

      <Separator />

      {/* Inbound address */}
      {inboundAddress && (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-medium">Your Brief address</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Subscribe to newsletters with this address and they&apos;ll appear in your Brief automatically.
              </p>
            </div>
            <InboundAddressCard address={inboundAddress} />
          </section>

          <Separator />
        </>
      )}

      {/* Delivery schedule */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Delivery schedule</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            When should your Brief arrive?
          </p>
        </div>
        <DeliveryScheduleForm
          initialFrequency={prefs?.digest_frequency ?? "daily"}
          initialTime={prefs?.digest_time ?? "08:00"}
          initialDay={prefs?.digest_day ?? 1}
          initialTimezone={timezone}
        />
      </section>

      <Separator />

      {/* Ignored topics */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Ignored topics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Topics temporarily suppressed from your Brief. They&apos;ll return automatically when the countdown expires.
          </p>
        </div>
        <IgnoredTopicsList initialSuppressions={suppressions} />
      </section>
    </div>
  );
}
