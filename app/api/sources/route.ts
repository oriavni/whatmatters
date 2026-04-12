import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectFeed } from "@/lib/rss/detect";
import { config } from "@/lib/config";
import { inngest } from "@/lib/inngest/client";

/** GET /api/sources — list the user's sources */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sources, error } = await supabase
    .from("sources")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: sources ?? [] });
}

/**
 * POST /api/sources — detect and add a source.
 *
 * Body: { input: string }
 *   input can be a URL, RSS feed URL, or "detect-only" flag.
 *
 * When action = "detect":
 *   Runs feed detection and returns the result without creating a row.
 *
 * When action = "add" (default):
 *   Creates the source row for a confirmed RSS feed.
 *
 * Body: { input: string, action?: "detect" | "add", feed_url?: string, feed_title?: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { input, action = "detect", feed_url, feed_title } = body as {
    input?: string;
    action?: "detect" | "add";
    feed_url?: string;
    feed_title?: string;
  };

  // ── action: detect ────────────────────────────────────────────────────────
  if (action === "detect") {
    if (!input?.trim()) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const result = await detectFeed(input.trim());

    if (result.type === "rss") {
      return NextResponse.json({
        detected_type: "rss",
        feed_url: result.feed_url,
        feed_title: result.feed_title,
        suggested_action: "rss_added",
      });
    }

    if (result.type === "ambiguous" || result.type === "newsletter") {
      const { data: profile } = await supabase
        .from("users")
        .select("inbound_slug")
        .eq("id", user.id)
        .single();

      const inboundAddress = profile?.inbound_slug
        ? `${profile.inbound_slug}@${config.postmark.inboundDomain}`
        : null;

      // Ambiguous: platform has an RSS feed AND is a newsletter — let user choose
      if (result.type === "ambiguous") {
        return NextResponse.json({
          detected_type: "ambiguous",
          feed_url: result.feed_url,
          feed_title: result.feed_title,
          brief_address: inboundAddress,
        });
      }

      return NextResponse.json({
        detected_type: "newsletter",
        suggested_action: "subscribe_with_brief_address",
        brief_address: inboundAddress,
        message:
          "This is a newsletter platform. Subscribe using your Brief address instead.",
      });
    }

    return NextResponse.json({
      detected_type: "unknown",
      suggested_action: "subscribe_with_brief_address",
      message: "Could not detect an RSS feed. If it's a newsletter, subscribe using your Brief address.",
    });
  }

  // ── action: add ───────────────────────────────────────────────────────────
  if (!feed_url?.trim()) {
    return NextResponse.json({ error: "feed_url is required" }, { status: 400 });
  }

  // Prevent duplicates
  const { data: existing } = await supabase
    .from("sources")
    .select("id")
    .eq("user_id", user.id)
    .eq("url", feed_url)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already have this feed in your sources." },
      { status: 409 }
    );
  }

  const { data: source, error: insertError } = await supabase
    .from("sources")
    .insert({
      user_id: user.id,
      type: "rss",
      name: feed_title?.trim() || new URL(feed_url).hostname,
      url: feed_url,
      status: "active",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Trigger an immediate one-time fetch so items are available right away.
  // Fire-and-forget — if this fails the source row is already saved and the
  // scheduled cron will pick it up on its next run.
  try {
    await inngest.send({
      name: "source/added",
      data: { source_id: source!.id, user_id: user.id },
    });
  } catch {
    // Non-fatal: log server-side but do not fail the response
    console.warn(`[sources] could not enqueue immediate fetch for ${source!.id}`);
  }

  return NextResponse.json({ source }, { status: 201 });
}
