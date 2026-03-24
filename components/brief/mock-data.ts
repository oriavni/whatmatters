/**
 * Mock digest data for development.
 * Replace with real API data in Prompt 9.
 */
export const MOCK_DIGEST = {
  id: "mock-digest-1",
  date: "Saturday, March 21, 2026",
  sourceCount: 8,
  storyCount: 12,
  readMinutes: 6,
  clusters: [
    {
      id: "cluster-1",
      label: "OpenAI releases GPT-5",
      synthesis:
        "OpenAI announced GPT-5 this week, its most capable model to date. The release comes earlier than most analysts expected and includes native multimodal capabilities across text, images, audio, and video. Several industry observers noted the model's improved reasoning on complex multi-step tasks, outperforming previous benchmarks by a significant margin.",
      sources: [
        { id: "s1", name: "The Verge", display_name: "The Verge", favicon_url: null, type: "rss" as const },
        { id: "s2", name: "Stratechery", display_name: "Stratechery", favicon_url: null, type: "email" as const },
        { id: "s3", name: "Import AI", display_name: "Import AI", favicon_url: null, type: "email" as const },
      ],
      interest_score: 0.92,
    },
    {
      id: "cluster-2",
      label: "The Fed holds rates steady",
      synthesis:
        "The Federal Reserve voted unanimously to hold interest rates at their current level, citing mixed inflation signals and a resilient labor market. Chair Powell indicated the committee sees no urgency to cut rates before Q3, dampening expectations that had priced in two cuts before mid-year.",
      sources: [
        { id: "s4", name: "The Daily Upside", display_name: "The Daily Upside", favicon_url: null, type: "email" as const },
        { id: "s5", name: "Bloomberg", display_name: "Bloomberg", favicon_url: null, type: "rss" as const },
      ],
      interest_score: 0.78,
    },
    {
      id: "cluster-3",
      label: "Apple's spatial computing push",
      synthesis:
        "Apple is reportedly accelerating development of a second-generation Vision Pro, with a lighter form factor and a lower price point targeting mainstream consumers. Multiple sources indicate a 2027 target, alongside a refreshed visionOS SDK that opens more system APIs to third-party developers.",
      sources: [
        { id: "s6", name: "MacRumors", display_name: "MacRumors", favicon_url: null, type: "rss" as const },
        { id: "s7", name: "Stratechery", display_name: "Stratechery", favicon_url: null, type: "email" as const },
      ],
      interest_score: 0.65,
    },
  ],
  quickMentions: [
    {
      id: "qm-1",
      label: "Stripe acquires financial analytics startup",
      source: "The Information",
    },
    {
      id: "qm-2",
      label: "LinkedIn tests AI-generated connection notes",
      source: "TechCrunch",
    },
    {
      id: "qm-3",
      label: "EU proposes new AI liability framework",
      source: "Sifted",
    },
    {
      id: "qm-4",
      label: "Y Combinator W26 batch announced",
      source: "YC Blog",
    },
  ],
};

export type MockCluster = (typeof MOCK_DIGEST.clusters)[0];
export type MockQuickMention = (typeof MOCK_DIGEST.quickMentions)[0];
