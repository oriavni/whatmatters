import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { config } from "@/lib/config";
import { BriefContainer } from "@/components/brief/BriefContainer";
import {
  getCurrentBriefForUser,
  getFreshnessForUser,
} from "@/lib/brief/getCurrentBrief";

export const metadata: Metadata = { title: "Brief" };

export default async function BriefPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const service = createServiceClient();
  const pageT0 = Date.now();

  // Fetch everything in parallel — profile, sources, subscription, digest,
  // and freshness all resolve in one round trip to the DB.
  const [profileResult, sourcesResult, subResult, briefResult, freshness] =
    await Promise.all([
      supabase
        .from("users")
        .select("inbound_slug, is_premium_override")
        .eq("id", user.id)
        .single(),
      supabase
        .from("sources")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active"),
      service
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle(),
      getCurrentBriefForUser(user.id, service).catch(() => null),
      getFreshnessForUser(user.id, service).catch(() => null),
    ]);

  console.log(`[BriefPage] parallel batch done in ${Date.now()-pageT0}ms`);
  // Interactions (liked/saved/ignore state) are deferred to the client so they
  // don't add a sequential round-trip to the SSR critical path. BriefContainer
  // fetches them after first paint — no skeleton, minimal layout shift.
  const inboundAddress = profileResult.data?.inbound_slug
    ? `${profileResult.data.inbound_slug}@${config.postmark.inboundDomain}`
    : `${user.id.replace(/-/g, "").slice(0, 16)}@${config.postmark.inboundDomain}`;

  const hasSourcesInitial = (sourcesResult.count ?? 0) > 0;
  const isPremiumInitial =
    profileResult.data?.is_premium_override === true ||
    subResult.data?.status === "active";

  return (
    <BriefContainer
      inboundAddress={inboundAddress}
      hasSourcesInitial={hasSourcesInitial}
      isPremiumInitial={isPremiumInitial}
      initialDigest={briefResult?.digest ?? null}
      initialGenerationStatus={briefResult?.generationStatus ?? "idle"}
      initialFreshness={freshness}
      initialInteractions={null}
    />
  );
}
