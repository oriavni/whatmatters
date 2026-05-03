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
  // Retail / fashion brand signals
  /new\s+arrivals?/i,                // "New Arrivals" / "New Arrival"
  /new\s+collection/i,               // "New Collection"
  /just\s+dropped/i,
  /now\s+(in\s+)?stores?/i,
  /shop\s+the\s+(look|season|edit|drop)/i,
  /קולקציה\s+חדשה/,                  // Hebrew: "new collection"
  /פריטים\s+חדשים/,                  // Hebrew: "new items"
  /מגיעים\s+חדשים/,                  // Hebrew: "new arrivals"
  /הנחה.*\d+%/,                      // Hebrew discount with %
  /\d+%.*הנחה/,                      // "30% הנחה"
  /מבצע\s+(מיוחד|עכשיו|סוף)/,       // Hebrew: "special/now/end sale"
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
  "newsletter@",
  "noreply@",
  "no-reply@",
  "store@",
  "shop@",
];

// Body signals — used to confirm sender-based detection or standalone retail signals
const BODY_PROMO_PATTERNS: RegExp[] = [
  /\d+%\s*off/i,
  /shop\s+now/i,
  /buy\s+now/i,
  /limited\s+time/i,
  /שופ|קניות|הזמנה|רכישה/, // Hebrew: shop, shopping, order, purchase
  /add\s+to\s+(cart|bag)/i,
  /view\s+(all|collection|lookbook|store)/i,
  /new\s+arrivals?/i,
  /new\s+collection/i,
  /₪\s*\d+/,                         // Israeli shekel price tag
  /\$\d+(\.\d{2})?/,                 // USD price tag
  /free\s+shipping/i,
  /סחורה|מחיר|הוסף\s+לסל|קנה/,      // Hebrew: goods, price, add to cart, buy
];

// Body signals strong enough to flag standalone (no sender check needed)
const BODY_STANDALONE_PATTERNS: RegExp[] = [
  /new\s+arrivals?.*shop\s+now/is,
  /shop\s+now.*new\s+(arrivals?|collection)/is,
  /קולקציה\s+חדשה.*לרכישה/s,
  /לרכישה.*קולקציה\s+חדשה/s,
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

  // 3. Strong combined retail signals in body alone (e.g. "New Arrivals … Shop Now")
  const bodySnippet = bodyText.slice(0, 2000);
  if (BODY_STANDALONE_PATTERNS.some((p) => p.test(bodySnippet))) {
    return true;
  }

  // 4. Multiple body promo signals together — retail brand newsletters often
  //    lack discount language in the subject but pack CTAs into the body.
  const bodyHits = BODY_PROMO_PATTERNS.filter((p) => p.test(bodySnippet)).length;
  if (bodyHits >= 3) {
    return true;
  }

  // 5. Hebrew ad marker anywhere in subject or first 500 chars of body
  const snippet = subjectLower + " " + bodyText.slice(0, 500);
  if (snippet.includes("פרסומת")) {
    return true;
  }

  return false;
}
