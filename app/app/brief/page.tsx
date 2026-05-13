import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { createServiceClient } from "@/lib/supabase/service";
import { config } from "@/lib/config";
import { BriefContainer } from "@/components/brief/BriefContainer";
import { getCurrentBriefForUser } from "@/lib/brief/getCurrentBrief";

export const metadata: Metadata = { title: "Brief" };

export default async function BriefPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // We only need the user-auth client for getUser() above.
  // All data queries below use the service client — we already have a verified
  // user.id, so we don't need RLS, and the service client is significantly faster
  // (avoids per-request JWT re-verification overhead).
  const service = createServiceClient();

  // Fetch everything in parallel — profile, sources, subscription, and digest.
  // Freshness (raw_items COUNT) is deferred to the client — it only drives the
  // "new items" badge on the Read Now button and is fine to arrive after paint.
  const [profileResult, sourcesResult, subResult, briefResult] =
    await Promise.all([
      service
        .from("users")
        .select("inbound_slug, is_premium_override")
        .eq("id", user.id)
        .single(),
      service
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
    ]);
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
      initialFreshness={null}
      initialInteractions={null}
    />
  );
}
