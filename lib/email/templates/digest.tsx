/**
 * Digest email template.
 *
 * Tiered rendering (product rules, enforced structurally):
 *
 *   rank < FULL_BLOCK_THRESHOLD → FULL BLOCK
 *     Topic heading + synthesis paragraph + source attribution + "Read →" link
 *
 *   rank ≥ FULL_BLOCK_THRESHOLD → SHORT MENTION
 *     Compact bullet in "More this period":
 *     Topic — one-line excerpt · Source names
 *
 * Rules applied here:
 *   - Source attribution shown on EVERY cluster, full or short.
 *   - No "what to do" / "why it matters" sections.
 *   - No decorative or AI-generated images. Original-source visuals only
 *     (V1: images omitted entirely for safe cross-client rendering).
 *   - Short mentions are visually lighter — they do not get synthesis paragraphs.
 */
import {
  Html,
  Head,
  Body,
  Container,
  Preview,
  Section,
  Text,
  Heading,
  Link,
  Hr,
} from "@react-email/components";
import * as React from "react";

// Tier selection is handled by the caller (digest-send) using score gap detection.
// Min/max caps are documented here for reference only.
// MIN_FULL_BLOCKS = 2, MAX_FULL_BLOCKS = 6

// ── Data types ────────────────────────────────────────────────────────────────

export interface DigestClusterForEmail {
  id: string;
  topic: string;
  summary: string | null;
  rank: number;
  isFullBlock: boolean; // determined by caller via score gap detection, not rank alone
  items: {
    id: string;
    title: string;
    sourceUrl: string | null;
    sourceName: string;
  }[];
}

export interface DigestEmailProps {
  digestId: string;
  subject: string;
  periodLabel: string;
  clusters: DigestClusterForEmail[];
  userEmail: string;
  replyToAddress: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
  appUrl: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  body: { backgroundColor: "#f9f9f7", margin: 0, padding: 0, fontFamily: "-apple-system,'Segoe UI',Arial,sans-serif" },
  container: { maxWidth: "600px", margin: "0 auto", backgroundColor: "#ffffff" },
  header: { backgroundColor: "#ffffff", padding: "28px 32px 16px", borderBottom: "1px solid #eeeeee" },
  wordmark: { fontSize: "18px", fontWeight: "700", color: "#111111", margin: 0 },
  dateLine: { fontSize: "13px", color: "#888888", margin: "4px 0 0" },
  section: { padding: "24px 32px 0" },
  clusterHeading: { fontSize: "17px", fontWeight: "600", color: "#111111", margin: "0 0 8px", lineHeight: "1.3" },
  synthesis: { fontSize: "15px", color: "#333333", lineHeight: "1.65", margin: "0 0 10px" },
  attribution: { fontSize: "12px", color: "#999999", margin: "0 0 6px" },
  readLink: { fontSize: "13px", color: "#4f46e5", textDecoration: "none" },
  divider: { borderColor: "#f0f0ee", margin: "20px 0" },
  moreHeading: { fontSize: "12px", fontWeight: "600", color: "#888888", textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 10px" },
  mention: { fontSize: "14px", color: "#444444", lineHeight: "1.5", margin: "0 0 7px" },
  mentionTopic: { fontWeight: "600" as const, color: "#222222" },
  mentionSource: { fontSize: "12px", color: "#bbbbbb" },
  footer: { padding: "20px 32px 28px", borderTop: "1px solid #eeeeee", marginTop: "24px" },
  footerText: { fontSize: "12px", color: "#aaaaaa", lineHeight: "1.6", margin: "0" },
  footerLink: { color: "#aaaaaa", textDecoration: "underline" },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function DigestEmail({
  subject,
  periodLabel,
  clusters,
  userEmail,
  replyToAddress: _replyToAddress, // used as the email reply-to header, not rendered
  unsubscribeUrl,
  preferencesUrl,
  appUrl,
}: DigestEmailProps) {
  const fullBlocks = clusters.filter((c) => c.isFullBlock);
  const shortMentions = clusters.filter((c) => !c.isFullBlock);

  return (
    <Html lang="en">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>

          {/* Header */}
          <Section style={s.header}>
            <Text style={s.wordmark}>Brief</Text>
            <Text style={s.dateLine}>{periodLabel}</Text>
          </Section>

          {/* Full story blocks */}
          {fullBlocks.map((cluster, idx) => (
            <React.Fragment key={cluster.id}>
              <Section style={s.section}>
                <Heading as="h2" style={s.clusterHeading}>
                  {cluster.topic}
                </Heading>

                {cluster.summary && (
                  <Text style={s.synthesis}>{cluster.summary}</Text>
                )}

                <Attribution items={cluster.items} />

                {cluster.items[0]?.sourceUrl && (
                  <Link href={cluster.items[0].sourceUrl} style={s.readLink}>
                    Read →
                  </Link>
                )}
              </Section>

              {idx < fullBlocks.length - 1 && <Hr style={s.divider} />}
            </React.Fragment>
          ))}

          {/* Short mentions — "More this period" */}
          {shortMentions.length > 0 && (
            <>
              <Hr style={{ ...s.divider, margin: "24px 0 0" }} />
              <Section style={{ ...s.section, paddingBottom: "8px" }}>
                <Text style={s.moreHeading}>More this period</Text>
                {shortMentions.map((cluster) => (
                  <Mention key={cluster.id} cluster={cluster} />
                ))}
              </Section>
            </>
          )}

          {/* Footer */}
          <Section style={s.footer}>
            <Text style={s.footerText}>
              Reply to interact with your Brief — try &quot;more on [topic]&quot; or &quot;skip [topic]&quot;.
            </Text>
            <Text style={{ ...s.footerText, marginTop: "8px" }}>
              Sent to {userEmail} ·{" "}
              <Link href={preferencesUrl} style={s.footerLink}>Preferences</Link>
              {" · "}
              <Link href={unsubscribeUrl} style={s.footerLink}>Unsubscribe</Link>
              {" · "}
              <Link href={`${appUrl}/app/brief`} style={s.footerLink}>View online</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Attribution({ items }: { items: DigestClusterForEmail["items"] }) {
  const names = [...new Set(items.map((i) => i.sourceName))];
  if (names.length === 0) return null;
  return <Text style={s.attribution}>via {names.join(", ")}</Text>;
}

function Mention({ cluster }: { cluster: DigestClusterForEmail }) {
  const excerpt = cluster.summary ?? cluster.items[0]?.title ?? "";
  const sources = [...new Set(cluster.items.map((i) => i.sourceName))];
  const sourceUrl = cluster.items[0]?.sourceUrl ?? null;
  return (
    <Text style={s.mention}>
      {sourceUrl ? (
        <Link href={sourceUrl} style={{ ...s.mentionTopic, color: "#222222", textDecoration: "none" }}>
          {cluster.topic}
        </Link>
      ) : (
        <span style={s.mentionTopic}>{cluster.topic}</span>
      )}
      {excerpt ? ` — ${excerpt}` : ""}
      {sources.length > 0 && (
        <span style={s.mentionSource}> · {sources.join(", ")}</span>
      )}
    </Text>
  );
}
