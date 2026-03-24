import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Discover"
        description="Recommended sources and curated Signals based on what you read."
      >
        <Badge variant="secondary">Coming soon</Badge>
      </PageHeader>

      <div className="py-16 text-center text-sm text-muted-foreground">
        Source discovery and curated Signals are coming in V1.5.
        <br />
        Once you have a few weeks of Brief history, we&apos;ll recommend sources
        based on your interests.
      </div>
    </div>
  );
}
