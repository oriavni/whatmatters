/**
 * GET /api/discover/sources?category=AI
 *
 * Returns up to 5 ranked discovery sources for the given category,
 * excluding any feed URLs the user has already added.
 *
 * Ranking: (coolness × 0.5) + (freshness × 0.3) + (trust × 0.2)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_RESULTS = 5;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.trim();
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const service = createServiceClient();

  // Fetch user's existing source URLs to exclude them
  const { data: userSources } = await service
    .from("sources")
    .select("url")
    .eq("user_id", user.id)
    .eq("status", "active");

  const existingUrls = new Set(
    (userSources ?? []).map((s) => s.url).filter(Boolean) as string[]
  );

  // Fetch all active discovery sources for this category
  const { data: candidates, error } = await service
    .from("discovery_sources")
    .select("id, name, url, feed_url, source_type, category, tags, description, coolness_score, freshness_score, trust_score")
    .eq("category", category)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ranked = (candidates ?? [])
    // Exclude sources the user already has (match by feed_url or url)
    .filter((s) => {
      if (s.feed_url && existingUrls.has(s.feed_url)) return false;
      if (existingUrls.has(s.url)) return false;
      return true;
    })
    // Rank by composite score
    .map((s) => ({
      ...s,
      _score: s.coolness_score * 0.5 + s.freshness_score * 0.3 + s.trust_score * 0.2,
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_RESULTS)
    .map(({ _score, ...s }) => s);

  return NextResponse.json({ sources: ranked });
}
