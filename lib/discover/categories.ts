/**
 * Shared category taxonomy for the Topic Discovery system.
 *
 * Used on the client to:
 *  - Define the eight discovery categories shown as topic cards
 *  - Map user's Brief cluster topics → relevance hints via keyword matching
 *
 * No LLM, no extra API call — pure string matching, runs in < 1ms.
 */

export interface DiscoveryCategory {
  id: string;
  name: string;
  /** Short description shown on the topic card */
  description: string;
  /** Keywords matched against cluster topic strings (case-insensitive) */
  keywords: string[];
  /** Hint shown when the category is NOT matched to the user's Brief */
  defaultHint: string;
}

export const DISCOVERY_CATEGORIES: DiscoveryCategory[] = [
  {
    id: "AI",
    name: "AI & Machine Learning",
    description: "The latest models, research breakthroughs, and the people building the AI future.",
    keywords: [
      "ai", "artificial intelligence", "machine learning", "gpt", "llm", "claude",
      "openai", "anthropic", "neural", "deep learning", "chatgpt", "gemini",
      "agents", "mistral", "model", "inference", "embedding", "transformer",
      "generative", "automation", "robotics", "copilot",
    ],
    defaultHint: "Trending in AI",
  },
  {
    id: "Startups",
    name: "Startups & Venture",
    description: "Founder stories, funding rounds, and the building blocks of new companies.",
    keywords: [
      "startup", "founder", "venture", "vc", "funding", "seed", "series",
      "saas", "yc", "accelerator", "unicorn", "product launch", "bootstrapped",
      "mrr", "arr", "go-to-market", "pitch", "pre-seed",
    ],
    defaultHint: "Hot in Startups",
  },
  {
    id: "Technology",
    name: "Technology",
    description: "Software, platforms, and the technologies changing how we live and work.",
    keywords: [
      "tech", "software", "app", "platform", "mobile", "cloud", "api",
      "developer", "open source", "hardware", "chip", "semiconductor",
      "cybersecurity", "data", "programming", "code", "browser", "operating system",
    ],
    defaultHint: "Popular in Tech",
  },
  {
    id: "Business",
    name: "Business & Finance",
    description: "Markets, strategy, and the forces shaping the global economy.",
    keywords: [
      "business", "economy", "market", "trade", "corporate", "revenue", "finance",
      "stock", "wall street", "merger", "acquisition", "ipo", "bank", "inflation",
      "gdp", "earnings", "quarterly", "profit", "investment", "interest rate",
    ],
    defaultHint: "Popular in Business",
  },
  {
    id: "Global Affairs",
    name: "Global Affairs",
    description: "Geopolitics, international relations, and the stories shaping nations.",
    keywords: [
      "politics", "government", "election", "policy", "war", "diplomacy",
      "nato", "china", "russia", "europe", "middle east", "ukraine", "geopolit",
      "congress", "senate", "president", "minister", "parliament", "sanctions",
      "tariff", "trade deal", "summit", "treaty",
    ],
    defaultHint: "Trending in Politics",
  },
  {
    id: "Culture",
    name: "Culture & Society",
    description: "Ideas, movements, and the conversations defining modern life.",
    keywords: [
      "culture", "art", "music", "film", "book", "media", "entertainment",
      "social", "trend", "fashion", "celebrity", "internet", "viral", "identity",
      "community", "movement", "generation", "streaming",
    ],
    defaultHint: "Popular in Culture",
  },
  {
    id: "Science",
    name: "Science & Research",
    description: "Breakthroughs, discoveries, and the frontiers of human knowledge.",
    keywords: [
      "science", "research", "study", "climate", "space", "health", "medicine",
      "biology", "physics", "chemistry", "nasa", "environment", "climate change",
      "energy", "quantum", "genome", "vaccine", "discovery",
    ],
    defaultHint: "New in Science",
  },
  {
    id: "Design",
    name: "Design & Product",
    description: "Product thinking, design craft, and building things people love.",
    keywords: [
      "design", "ux", "ui", "product", "figma", "branding", "creative",
      "interface", "user experience", "accessibility", "prototype", "typography",
    ],
    defaultHint: "Popular in Design",
  },
];

/**
 * Given a list of cluster topic strings from the user's current Brief,
 * returns a hint string for each category:
 *   - "Based on your Brief"  → category keyword found in any cluster topic
 *   - category.defaultHint   → no match
 *
 * Also returns a `fromBrief` boolean to allow sorting matched cards first.
 */
export function getCategoryHints(
  clusterTopics: string[]
): Map<string, { hint: string; fromBrief: boolean }> {
  const combinedText = clusterTopics.join(" ").toLowerCase();

  const map = new Map<string, { hint: string; fromBrief: boolean }>();
  for (const cat of DISCOVERY_CATEGORIES) {
    const fromBrief = cat.keywords.some((kw) => combinedText.includes(kw));
    map.set(cat.id, {
      hint: fromBrief ? "Based on your Brief" : cat.defaultHint,
      fromBrief,
    });
  }
  return map;
}

/**
 * Returns categories sorted: Brief-matched first, then alphabetical.
 * Used to decide which 6 cards to show.
 */
export function getSortedCategories(
  clusterTopics: string[]
): Array<DiscoveryCategory & { hint: string; fromBrief: boolean }> {
  const hints = getCategoryHints(clusterTopics);
  return DISCOVERY_CATEGORIES.map((cat) => ({
    ...cat,
    ...hints.get(cat.id)!,
  })).sort((a, b) => {
    if (a.fromBrief !== b.fromBrief) return a.fromBrief ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
