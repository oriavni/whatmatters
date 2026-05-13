"use client";

import { useState } from "react";
import { getSortedCategories } from "@/lib/discover/categories";
import { TopicCard } from "./TopicCard";
import { SourceDiscoveryModal } from "./SourceDiscoveryModal";
import type { BriefCluster } from "@/components/brief/types";

const MAX_CARDS = 6;

interface TopicDiscoveryProps {
  /** Clusters from the user's current Brief — used to compute relevance hints.
   *  Pass an empty array for users with no Brief (shows default hints). */
  clusters: BriefCluster[];
  onSourcesAdded?: (count: number) => void;
}

export function TopicDiscovery({ clusters, onSourcesAdded }: TopicDiscoveryProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<{ id: string; name: string } | null>(null);

  const clusterTopics = clusters.map((c) => c.topic);
  const categories = getSortedCategories(clusterTopics).slice(0, MAX_CARDS);

  function openDiscover(id: string, name: string) {
    setActiveCategory({ id, name });
    setModalOpen(true);
  }

  return (
    <>
      <section className="mt-10 pt-8 border-t">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground">Explore More</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Discover sources across topics you care about.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((cat) => (
            <TopicCard
              key={cat.id}
              name={cat.name}
              description={cat.description}
              hint={cat.hint}
              fromBrief={cat.fromBrief}
              onDiscover={() => openDiscover(cat.id, cat.name)}
            />
          ))}
        </div>
      </section>

      {activeCategory && (
        <SourceDiscoveryModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          categoryId={activeCategory.id}
          categoryName={activeCategory.name}
          onSourcesAdded={onSourcesAdded}
        />
      )}
    </>
  );
}
