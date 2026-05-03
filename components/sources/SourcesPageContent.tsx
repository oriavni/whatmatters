"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { AddSourceDialog } from "@/components/sources/AddSourceDialog";
import { SourceList } from "@/components/sources/SourceList";
import { CopyAddressButton } from "@/components/account/CopyAddressButton";
import { Mail } from "lucide-react";

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

      {/* Inbound address — shown here so users find it alongside their sources */}
      <div className="rounded-lg border bg-card px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Mail className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">Your Brief address</p>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <code className="text-xs font-mono bg-muted px-2.5 py-1.5 rounded-md flex-1 truncate">
            {inboundAddress}
          </code>
          <CopyAddressButton address={inboundAddress} />
        </div>
        <p className="text-xs text-muted-foreground sm:hidden">
          Subscribe to newsletters with this address to add them to your Brief.
        </p>
      </div>

      <SourceList
        refreshKey={refreshKey}
        inboundAddress={inboundAddress}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
