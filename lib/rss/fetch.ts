/**
 * RSS feed fetcher and normalizer.
 * Uses rss-parser which handles RSS 2.0, Atom, and RDF feeds.
 */
import Parser from "rss-parser";
import { cleanHtml } from "@/lib/ingestion/clean-html";

export interface RssItem {
  title: string;
  content: string;       // cleaned plain text
  url: string;           // canonical item URL (link or guid)
  published_at: string | null;
  source_name: string;
}

export interface RssFeed {
  title: string;
  url: string;
  items: RssItem[];
}

const USER_AGENT =
  "WhatMatters/1.0 (RSS reader; +https://whatmatters.app)";

// Shared parser instance — stateless, safe to reuse across requests
const parser = new Parser({
  timeout: 10_000,
  maxRedirects: 5,
  headers: { "User-Agent": USER_AGENT },
  // Pull full article HTML from content:encoded when present
  customFields: {
    item: [["content:encoded", "contentEncoded"]],
  },
});

type ParsedItem = Parser.Item & { contentEncoded?: string };

/**
 * Fetch and parse an RSS/Atom feed URL.
 * Throws on network error or unparseable feed.
 */
export async function fetchRssFeed(feedUrl: string): Promise<RssFeed> {
  const feed = await parser.parseURL(feedUrl);

  const sourceName = feed.title?.trim() || new URL(feedUrl).hostname;

  const items: RssItem[] = (feed.items as ParsedItem[])
    .map((item) => {
      const url = (item.link ?? item.guid ?? "").trim();
      if (!url) return null;

      // Priority: content:encoded > content > summary > contentSnippet (already plain text)
      const rawHtml = item.contentEncoded || item.content || item.summary || "";
      const plainFallback = item.contentSnippet ?? "";

      const content = rawHtml
        ? cleanHtml(rawHtml)
        : plainFallback.trim();

      const publishedAt =
        item.isoDate ??
        (item.pubDate ? new Date(item.pubDate).toISOString() : null);

      return {
        title: (item.title ?? "").trim(),
        content,
        url,
        published_at: publishedAt,
        source_name: sourceName,
      } satisfies RssItem;
    })
    .filter((item): item is RssItem => item !== null);

  return { title: sourceName, url: feedUrl, items };
}
