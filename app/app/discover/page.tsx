import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiscoverPageClient } from "@/components/discover/DiscoverPageClient";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-8">
        <PageHeader
          title="Discover"
          description="Explore curated sources across topics you care about."
        />
      </div>
      <DiscoverPageClient />
    </div>
  );
}
