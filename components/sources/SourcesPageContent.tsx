"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { AddSourceDialog } from "@/components/sources/AddSourceDialog";
import { SourceList } from "@/components/sources/SourceList";

interface SourcesPageContentProps {
  inboundAddress: string;
}

export function SourcesPageContent({ inboundAddress }: SourcesPageContentProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sources"
        description="Newsletters and RSS feeds in your Brief."
      >
        <AddSourceDialog onAdded={() => setRefreshKey((k) => k + 1)}>
          <Button size="sm">Add source</Button>
        </AddSourceDialog>
      </PageHeader>

      <SourceList
        refreshKey={refreshKey}
        inboundAddress={inboundAddress}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
