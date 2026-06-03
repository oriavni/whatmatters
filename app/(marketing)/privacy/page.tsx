import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — upto." };

const LAST_UPDATED = "June 3, 2025";
const CONTACT_EMAIL = "support@getupto.io";
const APP_URL = "https://www.getupto.io";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </div>

      <Section title="Who we are">
        <p>
          upto. (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the website{" "}
          <a href={APP_URL} className="underline underline-offset-2">{APP_URL}</a> and
          the upto. email digest service. Questions? Email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Account information</strong> — your email address and name when you sign up.</li>
          <li><strong>Newsletter content</strong> — emails and RSS feed items you route to your upto. inbound address, used solely to generate your digest.</li>
          <li><strong>Usage data</strong> — which digests you open, which topics you save or ignore, and reply commands you send. Used to personalize your digest.</li>
          <li><strong>Billing information</strong> — handled entirely by Creem (our payment processor). We do not store card numbers or payment details.</li>
          <li><strong>Technical data</strong> — standard server logs (IP address, browser type, request timestamps). Retained for up to 30 days for security purposes.</li>
        </ul>
      </Section>

      <Section title="How we use your data">
        <ul className="list-disc pl-5 space-y-2">
          <li>To generate and deliver your personalized email digest.</li>
          <li>To improve topic clustering, deduplication, and content quality.</li>
          <li>To send service-related emails (account setup, billing receipts, support replies).</li>
          <li>To detect and prevent abuse or unauthorized access.</li>
        </ul>
        <p className="mt-3">We do <strong>not</strong> sell your data, show you ads, or share your newsletter content with third parties.</p>
      </Section>

      <Section title="Data storage and security">
        <p>
          Your data is stored in the European Union using Supabase (PostgreSQL).
          All data is encrypted at rest and in transit (TLS). We apply
          role-based access controls and audit our security practices regularly.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>We use the following sub-processors to operate the service:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Supabase</strong> — database and authentication</li>
          <li><strong>Postmark</strong> — email delivery and inbound email processing</li>
          <li><strong>OpenAI</strong> — AI-powered digest generation (content is processed but not used to train OpenAI models)</li>
          <li><strong>Creem</strong> — payment processing and subscription management</li>
          <li><strong>Vercel</strong> — web hosting and infrastructure</li>
        </ul>
      </Section>

      <Section title="Data retention">
        <p>
          We retain your account data for as long as your account is active.
          If you delete your account, your personal data is removed within 30 days.
          Digest content and newsletter items are retained for 12 months to support
          your archive, then deleted.
        </p>
      </Section>

      <Section title="Your rights">
        <p>You may at any time:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Access the data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your account and associated data</li>
          <li>Export your digest history</li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We use only essential session cookies required for authentication.
          We do not use tracking cookies, analytics cookies, or third-party
          advertising cookies.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. We will notify active
          users of material changes by email at least 14 days before they
          take effect.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For privacy questions or requests, contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}
