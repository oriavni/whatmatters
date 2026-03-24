import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { AddSourceDialog } from "@/components/sources/AddSourceDialog";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sources"
        description="Newsletters and RSS feeds in your Brief."
      >
        <AddSourceDialog>
          <Button size="sm">Add source</Button>
        </AddSourceDialog>
      </PageHeader>

      {/* TODO (Prompt 11): <SourceList /> */}
      <div className="py-16 text-center text-sm text-muted-foreground">
        No sources yet. Add a newsletter or RSS feed to get started.
      </div>
    </div>
  );
}
