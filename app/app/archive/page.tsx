import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { SavedList } from "@/components/saved/SavedList";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Archive"
        description="Past Briefs, saved items, and pinned stories."
      />

      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Sort</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Newest first</MenubarItem>
            <MenubarItem>Oldest first</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Filter</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>All sources</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>This week</MenubarItem>
            <MenubarItem>This month</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <Tabs defaultValue="briefs">
        <TabsList>
          <TabsTrigger value="briefs">Past Briefs</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="pinned">Pinned</TabsTrigger>
        </TabsList>
        <TabsContent value="briefs" className="mt-6">
          <EmptyState message="No past Briefs yet. Your first one will appear here after it's sent." />
        </TabsContent>
        <TabsContent value="saved" className="mt-6">
          <SavedList />
        </TabsContent>
        <TabsContent value="pinned" className="mt-6">
          <EmptyState message="No pinned items yet. Pin important stories to keep them here." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
