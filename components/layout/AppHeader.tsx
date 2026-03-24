"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { usePathname } from "next/navigation";

// Map route prefixes → display names for the breadcrumb
const PAGE_LABELS: Array<[string, string]> = [
  ["/app/brief",       "Brief"],
  ["/app/archive",     "Archive"],
  ["/app/sources",     "Sources"],
  ["/app/discover",    "Discover"],
  ["/app/preferences", "Preferences"],
  ["/app/account",     "Account"],
];

function getPageLabel(pathname: string): string {
  const match = PAGE_LABELS.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : "WhatMatters";
}

export function AppHeader() {
  const pathname = usePathname();
  const label = getPageLabel(pathname);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4 sticky top-0 z-40">
      {/* Sidebar toggle — on desktop collapses/expands; on mobile opens the Sheet */}
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="h-4" />

      {/* Page title — simple breadcrumb */}
      <span className="text-sm font-medium truncate">{label}</span>
    </header>
  );
}
