import { PageHeader } from "@/components/layout/PageHeader";
import { SavedList } from "@/components/saved/SavedList";

export default function SavedPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved"
        description="Stories you've bookmarked from your Briefs."
      />
      <SavedList />
    </div>
  );
}
