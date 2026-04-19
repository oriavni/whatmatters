import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode | string | null | undefined }) {
  return (
    <div className="flex gap-4 px-4 py-2.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="font-medium break-all">{value ?? "—"}</span>
    </div>
  );
}

export default async function InboundDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = createServiceClient();

  const { data: item } = await supabase
    .from("raw_items")
    .select("id, user_id, subject, sender_email, sender_name, source_id, source_type, received_at, is_processed, body_text, summary, metadata")
    .eq("id", id)
    .single();

  if (!item) notFound();

  const [userResult, sourceResult] = await Promise.all([
    supabase.from("users").select("email").eq("id", item.user_id).single(),
    item.source_id
      ? supabase.from("sources").select("id, name, type, status").eq("id", item.source_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const userRow = userResult.data;
  const source = sourceResult.data;
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        <Link href="/admin?tab=inbound" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back to inbound
        </Link>

        <div>
          <h1 className="text-lg font-semibold">{item.subject ?? "(no subject)"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatDate(item.received_at)}</p>
        </div>

        {/* Metadata */}
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Email metadata</h2>
          <div className="rounded-lg border overflow-hidden">
            <Row label="User" value={userRow?.email} />
            <Row label="Sender email" value={item.sender_email} />
            <Row label="Sender name" value={item.sender_name} />
            <Row label="Subject" value={item.subject} />
            <Row label="Received at" value={formatDate(item.received_at)} />
            <Row label="Type" value={item.source_type} />
            <Row label="Processed" value={item.is_processed ? "Yes" : "No"} />
            {metadata.postmark_message_id != null && (
              <Row label="Postmark ID" value={String(metadata.postmark_message_id)} />
            )}
          </div>
        </section>

        {/* Source attribution */}
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Source attribution</h2>
          <div className="rounded-lg border overflow-hidden">
            {source ? (
              <>
                <Row label="Source name" value={source.name} />
                <Row label="Source type" value={source.type} />
                <Row label="Source status" value={source.status} />
                <Row label="Source ID" value={<span className="font-mono text-xs">{source.id}</span>} />
              </>
            ) : (
              <div className="px-4 py-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  No source attributed — this email was not matched to any known source
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Body */}
        {item.summary && (
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">LLM summary</h2>
            <div className="rounded-lg border px-4 py-3">
              <p className="text-sm">{item.summary}</p>
            </div>
          </section>
        )}

        {item.body_text && (
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Parsed body</h2>
            <div className="rounded-lg border px-4 py-3 max-h-96 overflow-y-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {item.body_text}
              </pre>
            </div>
          </section>
        )}

        {/* Raw metadata */}
        {Object.keys(metadata).length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Raw metadata</h2>
            <div className="rounded-lg border px-4 py-3">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
