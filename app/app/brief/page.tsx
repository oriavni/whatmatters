import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { isAudioPremium } from "@/lib/audio/premium";
import { BriefContainer } from "@/components/brief/BriefContainer";

export const metadata: Metadata = { title: "Brief" };

export default async function BriefPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult, sourcesResult, isPremiumInitial] = await Promise.all([
    supabase
      .from("users")
      .select("inbound_slug")
      .eq("id", user.id)
      .single(),
    supabase
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
    isAudioPremium(user.id),
  ]);

  const inboundAddress = profileResult.data?.inbound_slug
    ? `${profileResult.data.inbound_slug}@${config.postmark.inboundDomain}`
    : `${user.id.replace(/-/g, "").slice(0, 16)}@${config.postmark.inboundDomain}`;

  const hasSourcesInitial = (sourcesResult.count ?? 0) > 0;

  return (
    <BriefContainer
      inboundAddress={inboundAddress}
      hasSourcesInitial={hasSourcesInitial}
      isPremiumInitial={isPremiumInitial}
    />
  );
}
