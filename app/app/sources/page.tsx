import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/get-user";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { SourcesPageContent } from "@/components/sources/SourcesPageContent";

export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("inbound_slug")
    .eq("id", user.id)
    .single();

  const inboundAddress = profile?.inbound_slug
    ? `${profile.inbound_slug}@${config.postmark.inboundDomain}`
    : `${user.id.replace(/-/g, "").slice(0, 16)}@${config.postmark.inboundDomain}`;

  return <SourcesPageContent inboundAddress={inboundAddress} />;
}
