/**
 * detectPromotional
 *
 * Returns true if the email is clearly a promotional/advertising email
 * that should be excluded from digest generation.
 *
 * Conservative by design — only flags high-confidence signals to avoid
 * false positives on legitimate newsletters.
 */

// Subject signals — very high confidence
const SUBJECT_PATTERNS: RegExp[] = [
  /פרסומת/,                          // Israeli ad disclosure (legal requirement)
  /\d+%\s*off/i,                     // "20% off"
  /get\s+\d+%/i,                     // "get 10% off"
  /save\s+\d+%/i,                    // "save 30%"
  /up\s+to\s+\d+%/i,                 // "up to 50% off"
  /flash\s+sale/i,
  /limited[\s-]time\s+offer/i,
  /exclusive\s+(deal|offer|discount)/i,
  /special\s+offer/i,
  /clearance/i,
  /buy\s+now[\s,]/i,
];

// Sender email local-part patterns — high confidence when combined with
// commercial body content (not used alone to avoid false positives)
const PROMOTIONAL_SENDER_PREFIXES = [
  "promotions@",
  "marketing@",
  "offers@",
  "deals@",
  "sales@",
  "promo@",
  "discount@",
];

// Body signals — only used to confirm sender-based detection
const BODY_PROMO_PATTERNS: RegExp[] = [
  /\d+%\s*off/i,
  /shop\s+now/i,
  /buy\s+now/i,
  /limited\s+time/i,
  /שופ|קניות|הזמנה|רכישה/, // Hebrew: shop, shopping, order, purchase
];

export function detectPromotional(
  subject: string | null,
  bodyText: string,
  senderEmail: string
): boolean {
  const subjectLower = (subject ?? "").toLowerCase();
  const senderLower = senderEmail.toLowerCase();

  // 1. Subject pattern match — high confidence, flag immediately
  if (SUBJECT_PATTERNS.some((p) => p.test(subject ?? ""))) {
    return true;
  }

  // 2. Promotional sender prefix + any body promo signal — combined signal
  const isPromoSender = PROMOTIONAL_SENDER_PREFIXES.some((prefix) =>
    senderLower.includes(prefix)
  );
  if (isPromoSender && BODY_PROMO_PATTERNS.some((p) => p.test(bodyText))) {
    return true;
  }

  // 3. Hebrew ad marker anywhere in subject or first 500 chars of body
  const snippet = subjectLower + " " + bodyText.slice(0, 500);
  if (snippet.includes("פרסומת")) {
    return true;
  }

  return false;
}
