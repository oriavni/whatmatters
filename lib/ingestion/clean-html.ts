/**
 * HTML cleaning and plain-text extraction for email bodies.
 *
 * Uses node-html-parser for proper DOM-based parsing. The pipeline is:
 *   1. Parse the raw HTML into a DOM tree (handles malformed markup).
 *   2. Remove noise subtrees: scripts, styles, invisible elements, and
 *      common newsletter boilerplate (nav, footer, unsubscribe sections).
 *   3. Walk remaining nodes in document order, emitting text and newlines
 *      at block boundaries to preserve reading structure.
 *   4. Normalise whitespace.
 *
 * ── Tradeoff vs @mozilla/readability + jsdom ──────────────────────────────
 * Readability is designed for articles with a clear <article>/<main> region
 * and uses content-density scoring to isolate the "body". Most newsletter
 * HTML is table-based marketing email with no semantic article structure —
 * Readability frequently scores the wrong region and returns too little.
 *
 * node-html-parser gives us direct DOM access at ~1 MB installed with no
 * native dependencies, handles malformed HTML well, and lets us remove noise
 * by explicit rules (selectors + class heuristics) that are predictable and
 * tunable. That is more reliable for newsletters at V1 than a generic scorer.
 * The downside is that we must maintain the noise-removal rules ourselves;
 * for V1 the set below covers the vast majority of real newsletter layouts.
 */
import { parse, type HTMLElement } from "node-html-parser";

// ── Tags whose entire subtree is structural noise ─────────────────────────────
const REMOVE_TAGS = new Set([
  "script",
  "style",
  "head",
  "noscript",
  "nav",
  "header",
  "footer",
  "aside",
  "figure",
  "figcaption",
  "iframe",
  "svg",
  "canvas",
  "video",
  "audio",
]);

// ── ARIA roles that signal navigation / banner / footer ───────────────────────
const REMOVE_ROLES = new Set(["navigation", "banner", "contentinfo", "complementary"]);

// ── Class/id fragments that strongly indicate boilerplate ─────────────────────
// Matched case-insensitively against the element's class + id attributes.
const BOILERPLATE_PATTERNS = [
  "unsubscribe",
  "opt-out",
  "optout",
  "manage-pref",
  "manage_pref",
  "email-footer",
  "email-header",
  "preheader",
  "pre-header",
  "view-in-browser",
  "view_in_browser",
  "social-links",
  "social_links",
  "footer-links",
  "footer_links",
];

// ── Block-level tags: emit a newline after their text content ─────────────────
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "main",
  "blockquote",
  "pre",
  "li",
  "tr",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "address",
  "hr",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "dt",
  "dd",
]);

/**
 * Strip HTML and return clean plain text, preserving paragraph/block structure.
 * Handles malformed and table-heavy newsletter HTML correctly.
 */
export function cleanHtml(html: string): string {
  const root = parse(html, {
    lowerCaseTagName: true,
    comment: false,
    blockTextElements: { script: false, noscript: false, style: false },
  });

  removeNoise(root);

  const parts: string[] = [];
  walkText(root, parts);

  return parts
    .join("")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Truncate text to a target character count, breaking at a word boundary. */
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf(" ", maxChars);
  return cut > 0 ? text.slice(0, cut) + "…" : text.slice(0, maxChars) + "…";
}

/**
 * Extract a short preview from cleaned plain text without any LLM call.
 * Strategy: take the first complete sentence that fits within maxChars.
 * If no sentence boundary is found, fall back to word-boundary truncation.
 * Returns null when the text is too short to be worth previewing (<20 chars).
 */
export function excerptText(text: string, maxChars = 200): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 20) return null;
  if (trimmed.length <= maxChars) return trimmed;

  // Look for the last sentence-ending punctuation within the limit
  const candidate = trimmed.slice(0, maxChars + 1);
  const sentenceEnd = Math.max(
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? "),
    candidate.lastIndexOf(".\n"),
  );

  if (sentenceEnd > 40) {
    // +1 to include the punctuation character itself
    return trimmed.slice(0, sentenceEnd + 1).trim();
  }

  // Fall back to word boundary
  return truncateText(trimmed, maxChars);
}

// ── Internals ─────────────────────────────────────────────────────────────────

function removeNoise(root: HTMLElement): void {
  // Remove by tag name
  for (const tag of REMOVE_TAGS) {
    root.querySelectorAll(tag).forEach((el) => el.remove());
  }

  // Remove by ARIA role
  for (const role of REMOVE_ROLES) {
    root.querySelectorAll(`[role="${role}"]`).forEach((el) => el.remove());
  }

  // Remove elements hidden via inline style (display:none / visibility:hidden)
  root.querySelectorAll("[style]").forEach((el) => {
    const style = (el.getAttribute("style") ?? "").toLowerCase();
    if (style.includes("display:none") || style.includes("display: none") ||
        style.includes("visibility:hidden") || style.includes("visibility: hidden")) {
      el.remove();
    }
  });

  // Remove boilerplate sections by class/id heuristic
  const allElements = root.querySelectorAll("[class],[id]");
  for (const el of allElements) {
    const classAttr = (el.getAttribute("class") ?? "").toLowerCase();
    const idAttr = (el.getAttribute("id") ?? "").toLowerCase();
    const combined = `${classAttr} ${idAttr}`;
    if (BOILERPLATE_PATTERNS.some((pattern) => combined.includes(pattern))) {
      el.remove();
    }
  }
}

function walkText(node: HTMLElement, parts: string[]): void {
  for (const child of node.childNodes) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      // Raw text node — include as-is (parser already decoded entities)
      const text = child.rawText;
      if (text) parts.push(text);
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const el = child as HTMLElement;
      const tag = el.tagName?.toLowerCase() ?? "";

      if (tag === "br") {
        parts.push("\n");
        continue;
      }
      if (tag === "hr") {
        parts.push("\n");
        continue;
      }
      if (tag === "a") {
        // Include link text but skip href — avoids cluttering output with URLs
        walkText(el, parts);
        continue;
      }
      if (tag === "img") {
        // Substitute alt text when present
        const alt = el.getAttribute("alt")?.trim();
        if (alt) parts.push(` ${alt} `);
        continue;
      }

      const isBlock = BLOCK_TAGS.has(tag);
      walkText(el, parts);
      if (isBlock) parts.push("\n");
    }
  }
}
