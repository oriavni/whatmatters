/**
 * forwardConfirmationEmail
 *
 * Detects subscription confirmation / double opt-in emails and forwards them
 * to the user's real email address so they can click the confirmation link.
 *
 * Called from processInboundEmail (and the Inngest email-inbound function) after
 * the raw item is stored. Safe to call on every inbound — exits immediately if
 * the email doesn't look like a confirmation request.
 */
import { sendEmail } from "@/lib/email/postmark";

// Keywords that indicate a confirmation / double opt-in email.
// Checked against the subject and plain-text body (case-insensitive).
const CONFIRMATION_SUBJECT_KEYWORDS = [
  "confirm", "verify", "activate", "validate", "opt-in",
  "אשר", "אישור", "אימות", "אמת", "לאישור",
];

const CONFIRMATION_BODY_KEYWORDS = [
  "confirm your", "verify your", "confirm subscription", "confirm your email",
  "please confirm", "click to confirm", "click here to confirm",
  "לאישור הרשמה", "לאשר", "לחצו כאן לאישור", "אשרו הרשמה",
];

// URL path segments that commonly appear in confirmation links.
const CONFIRMATION_URL_PATTERNS = [
  /confirm/i, /verify/i, /activate/i, /validate/i,
  /opt.?in/i, /double.?opt/i,
  /token=/i, /confirmation/i,
];

/**
 * Returns true if the email looks like a double opt-in confirmation.
 */
function isConfirmationEmail(subject: string, bodyText: string): boolean {
  const combined = `${subject} ${bodyText}`.toLowerCase();

  if (CONFIRMATION_SUBJECT_KEYWORDS.some((kw) => subject.toLowerCase().includes(kw))) {
    return true;
  }
  if (CONFIRMATION_BODY_KEYWORDS.some((kw) => combined.includes(kw))) {
    return true;
  }
  return false;
}

/**
 * Extracts the most likely confirmation URL from raw HTML.
 * Returns null if nothing plausible is found.
 */
function extractConfirmationUrl(html: string): string | null {
  // Find all href values
  const hrefRegex = /href=["']([^"']+)["']/gi;
  const hrefs: string[] = [];
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.startsWith("http") || url.startsWith("https")) {
      hrefs.push(url);
    }
  }

  // Prefer a URL that looks like a confirmation link
  const confirmed = hrefs.find((url) =>
    CONFIRMATION_URL_PATTERNS.some((p) => p.test(url))
  );
  if (confirmed) return confirmed;

  // Fallback: return the first real http URL (often the CTA button)
  return hrefs.find((url) => !url.includes("unsubscribe")) ?? null;
}

export async function forwardConfirmationEmail({
  subject,
  bodyText,
  rawHtml,
  senderName,
  userEmail,
}: {
  subject: string | null;
  bodyText: string;
  rawHtml: string | null;
  senderName: string;
  userEmail: string;
}): Promise<void> {
  if (!isConfirmationEmail(subject ?? "", bodyText)) return;

  const confirmUrl = rawHtml ? extractConfirmationUrl(rawHtml) : null;

  const fromLabel = senderName || "a newsletter";
  const subjectLine = `Brief: confirm your subscription from ${fromLabel}`;

  const lines = [
    `A subscription confirmation arrived at your Brief inbound address from ${fromLabel}.`,
    ``,
    `To activate the subscription and start receiving it in your Brief, click the link below:`,
    ``,
    confirmUrl
      ? confirmUrl
      : `(The confirmation link could not be extracted automatically. Check your Brief inbound address settings to find the original email.)`,
    ``,
    `— Brief`,
  ];

  const text = lines.join("\n");
  const html = lines
    .map((line) =>
      line.startsWith("http")
        ? `<p><a href="${line}" style="font-weight:600;">${line}</a></p>`
        : line
        ? `<p>${line}</p>`
        : ""
    )
    .join("");

  await sendEmail({
    to: userEmail,
    subject: subjectLine,
    textBody: text,
    htmlBody: html,
  });

  console.log("[forward-confirmation] forwarded to", userEmail, "| url:", confirmUrl ?? "not found");
}
