import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { BriefContainer } from "@/components/brief/BriefContainer";

export const metadata: Metadata = { title: "Brief" };

export default async function BriefPage() {
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

  return <BriefContainer inboundAddress={inboundAddress} />;
}
