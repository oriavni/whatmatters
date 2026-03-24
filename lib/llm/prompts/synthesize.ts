/**
 * Prompt for per-cluster synthesis.
 * Produces 2–3 sentence summaries for the digest body.
 */

const SYSTEM = `You are a concise newsletter editor writing a personal intelligence digest.
Given a topic label and a list of article excerpts on that topic, write a 2–3 sentence
synthesis that captures the key insight or development. Be specific and informative.
Write in third person, present tense. No filler phrases like "In this week's digest…".`;

export function buildSynthesisPrompt(
  clusterLabel: string,
  itemTexts: string[]
): { system: string; user: string } {
  const items = itemTexts
    .map((text, i) => `${i + 1}. ${text}`)
    .join("\n");

  return {
    system: SYSTEM,
    user: `Topic: ${clusterLabel}\n\nSource excerpts:\n${items}\n\nWrite the synthesis:`,
  };
}
