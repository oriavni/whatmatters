/**
 * RSS feed detection.
 * Given a URL (feed or website), attempts to locate a valid RSS/Atom feed.
 */
import Parser from "rss-parser";

export interface DetectRssResult {
  type: "rss";
  feed_url: string;
  feed_title: string;
}

/**
 * Returned when a URL belongs to a known newsletter platform but also
 * exposes a parseable RSS/Atom feed. The user should be offered both
 * options: add as RSS feed, or subscribe via their Brief address.
 */
export interface DetectAmbiguousResult {
  type: "ambiguous";
  feed_url: string;
  feed_title: string;
}

export interface DetectNonRssResult {
  type: "newsletter" | "unknown";
}

export type DetectResult = DetectRssResult | DetectAmbiguousResult | DetectNonRssResult;

const USER_AGENT = "WhatMatters/1.0 (feed detector; +https://whatmatters.app)";
const TIMEOUT_MS = 8_000;

// Common RSS paths to probe when the URL itself is not a feed
const RSS_PROBE_PATHS = [
  "/feed",
  "/rss",
  "/rss.xml",
  "/feed.xml",
  "/atom.xml",
  "/feed/atom",
  "/index.xml",
  "/blog/feed",
  "/blog/rss.xml",
];

const RSS_CONTENT_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/xml",
  "text/xml",
]);

// Common newsletter platform domains — these may also expose RSS feeds,
// so detection continues even when a match is found (see detectFeed).
const NEWSLETTER_DOMAINS = [
  "substack.com",
  "beehiiv.com",
  "mailchimp.com",
  "convertkit.com",
  "buttondown.email",
  "ghost.io",
  "mailerlite.com",
  "campaignmonitor.com",
];

const parser = new Parser({ timeout: TIMEOUT_MS, headers: { "User-Agent": USER_AGENT } });

/**
 * Try to resolve a feed URL from user input.
 * Returns immediately on the first successful parse.
 */
export async function detectFeed(input: string): Promise<DetectResult> {
  const normalized = normalizeUrl(input);
  if (!normalized) return { type: "unknown" };

  const url = new URL(normalized);

  // Check if the host matches a known newsletter platform.
  // Unlike before, we don't short-circuit here — newsletter platforms often
  // also expose RSS feeds (Substack, Ghost, Beehiiv all do). We attempt RSS
  // detection regardless and return "ambiguous" when both are true.
  const isNewsletter = NEWSLETTER_DOMAINS.some(
    (d) => url.hostname === d || url.hostname.endsWith(`.${d}`)
  );

  // 1. Try the URL directly
  const direct = await tryParseFeed(normalized);
  if (direct) {
    return isNewsletter
      ? { type: "ambiguous", feed_url: direct.feed_url, feed_title: direct.feed_title }
      : direct;
  }

  // 2. Check Content-Type header (cheap HEAD request) to confirm it's not HTML
  const looksLikeFeed = await headIsFeed(normalized);
  if (!looksLikeFeed) {
    // 3. Probe common RSS paths under the origin
    const origin = url.origin;
    for (const path of RSS_PROBE_PATHS) {
      const candidate = origin + path;
      const result = await tryParseFeed(candidate);
      if (result) {
        return isNewsletter
          ? { type: "ambiguous", feed_url: result.feed_url, feed_title: result.feed_title }
          : result;
      }
    }
  }

  // RSS detection exhausted — fall back to newsletter or unknown
  return isNewsletter ? { type: "newsletter" } : { type: "unknown" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function tryParseFeed(url: string): Promise<DetectRssResult | null> {
  try {
    const feed = await parser.parseURL(url);
    if (feed.items?.length >= 0) {
      return {
        type: "rss",
        feed_url: url,
        feed_title: feed.title?.trim() || new URL(url).hostname,
      };
    }
  } catch {
    // Not a parseable feed — try next candidate
  }
  return null;
}

async function headIsFeed(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ct = res.headers.get("content-type") ?? "";
    return RSS_CONTENT_TYPES.has(ct.split(";")[0].trim().toLowerCase());
  } catch {
    return false;
  }
}

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    // Only http(s) — reject mailto:, ftp:, etc.
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}
