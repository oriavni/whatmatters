"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";

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
    <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{label}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
