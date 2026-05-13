"use client";

import { useState } from "react";
import { DISCOVERY_CATEGORIES } from "@/lib/discover/categories";
import { TopicCard } from "./TopicCard";
import { SourceDiscoveryModal } from "./SourceDiscoveryModal";

export function DiscoverPageClient() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<{ id: string; name: string } | null>(null);

  function openDiscover(id: string, name: string) {
    setActiveCategory({ id, name });
    setModalOpen(true);
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DISCOVERY_CATEGORIES.map((cat) => (
          <TopicCard
            key={cat.id}
            name={cat.name}
            description={cat.description}
            hint={cat.defaultHint}
            fromBrief={false}
            onDiscover={() => openDiscover(cat.id, cat.name)}
          />
        ))}
      </div>

      {activeCategory && (
        <SourceDiscoveryModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          categoryId={activeCategory.id}
          categoryName={activeCategory.name}
        />
      )}
    </>
  );
}
