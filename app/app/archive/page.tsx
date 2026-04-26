import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SavedList } from "@/components/saved/SavedList";

export const metadata: Metadata = { title: "Archive" };

const STATUS_LABELS: Record<string, string> = {
  sent:       "Sent",
  ready:      "Ready",
  generating: "Generating",
  pending:    "Pending",
  failed:     "Failed",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent:       "secondary",
  ready:      "outline",
  generating: "outline",
  pending:    "outline",
  failed:     "destructive",
};

export default async function ArchivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceSupabase = createServiceClient();

  // Load past digests — sent or ready only (exclude in-progress)
  const { data: digests } = await serviceSupabase
    .from("digests")
    .select("id, subject, period_end, status")
    .eq("user_id", user.id)
    .in("status", ["sent", "ready", "failed"])
    .order("period_end", { ascending: false })
    .limit(50);

  const rows = digests ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Archive"
        description="Past Briefs and saved items."
      />

      <Tabs defaultValue="briefs">
        <TabsList>
          <TabsTrigger value="briefs">Past Briefs</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
        </TabsList>

        {/* ── Past Briefs ── */}
        <TabsContent value="briefs" className="mt-6">
          {rows.length === 0 ? (
            <EmptyState message="No past Briefs yet. Your first one will appear here after it's sent." />
          ) : (
            <div className="divide-y">
              {rows.map((digest) => {
                const date = new Date(digest.period_end ?? "").toLocaleDateString("en-US", {
                  weekday: "short",
                  month:   "short",
                  day:     "numeric",
                  year:    "numeric",
                });
                const statusLabel   = STATUS_LABELS[digest.status]   ?? digest.status;
                const statusVariant = STATUS_VARIANTS[digest.status]  ?? "outline";

                return (
                  <div key={digest.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/app/brief/${digest.id}`}
                        className="font-medium text-sm hover:underline truncate block"
                      >
                        {digest.subject ?? "Brief"}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                    </div>
                    <Badge variant={statusVariant} className="shrink-0 text-xs">
                      {statusLabel}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Saved ── */}
        <TabsContent value="saved" className="mt-6">
          <SavedList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
