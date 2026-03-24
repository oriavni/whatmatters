import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Archive"
        description="Past Briefs, saved items, and pinned stories."
      />
      <Tabs defaultValue="briefs">
        <TabsList>
          <TabsTrigger value="briefs">Past Briefs</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="pinned">Pinned</TabsTrigger>
        </TabsList>
        <TabsContent value="briefs" className="mt-6">
          {/* TODO (Prompt 9): ArchiveList component */}
          <EmptyState message="No past Briefs yet. Your first one will appear here after it's sent." />
        </TabsContent>
        <TabsContent value="saved" className="mt-6">
          <EmptyState message="No saved items yet. Save stories from any Brief." />
        </TabsContent>
        <TabsContent value="pinned" className="mt-6">
          <EmptyState message="No pinned items yet. Pin important stories to keep them here." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-16 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
