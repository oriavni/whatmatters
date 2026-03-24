/**
 * Match an inbound email sender to an existing Source row.
 * If no match, auto-creates a new newsletter source for this user.
 *
 * Uses the service-role client — called from Inngest functions which
 * run outside a user session.
 */
import { createServiceClient } from "@/lib/supabase/service";

export interface IdentifySourceResult {
  sourceId: string;
  isNew: boolean;
}

/**
 * Find or create a newsletter Source for the given sender.
 *
 * Match priority:
 *   1. Exact email address match on `sources.url`
 *   2. Domain match (e.g. all mail from *@substack.com → same source)
 *
 * A new source is only auto-created when no match is found at either level.
 */
export async function identifySource(
  userId: string,
  senderAddress: string,
  senderName: string
): Promise<IdentifySourceResult> {
  const supabase = createServiceClient();
  const senderDomain = senderAddress.split("@")[1] ?? "";

  // 1. Exact address match
  const { data: exactMatch } = await supabase
    .from("sources")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "newsletter")
    .eq("url", senderAddress)
    .maybeSingle();

  if (exactMatch) {
    return { sourceId: exactMatch.id, isNew: false };
  }

  // 2. Domain match — find any newsletter source whose url ends with @{domain}
  const { data: domainMatches } = await supabase
    .from("sources")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "newsletter")
    .ilike("url", `%@${senderDomain}`)
    .limit(1);

  if (domainMatches && domainMatches.length > 0) {
    return { sourceId: domainMatches[0].id, isNew: false };
  }

  // 3. No match — auto-create a new newsletter source
  const name =
    senderName ||
    senderDomain.replace(/^(mail|newsletter|noreply|no-reply|news)\./i, "") ||
    senderAddress;

  const { data: newSource, error } = await supabase
    .from("sources")
    .insert({
      user_id: userId,
      type: "newsletter",
      name,
      url: senderAddress,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !newSource) {
    throw new Error(`identifySource: failed to create source — ${error?.message}`);
  }

  return { sourceId: newSource.id, isNew: true };
}
