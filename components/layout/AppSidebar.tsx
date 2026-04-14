"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BookOpen, Bookmark, Radio, Compass, Settings } from "lucide-react";
import { UserNav } from "./UserNav";

const navItems = [
  { label: "Brief",       href: "/app/brief",       icon: BookOpen },
  { label: "Saved",       href: "/app/saved",       icon: Bookmark },
  { label: "Sources",     href: "/app/sources",     icon: Radio    },
  { label: "Discover",    href: "/app/discover",    icon: Compass  },
  { label: "Preferences", href: "/app/preferences", icon: Settings },
] as const;

interface AppSidebarProps {
  userEmail: string;
}

export function AppSidebar({ userEmail }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/app/brief" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-foreground text-background">
                <span className="text-[0.625rem] font-bold leading-none">W</span>
              </div>
              <span className="font-semibold text-sm tracking-tight">WhatMatters</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserNav email={userEmail} />
      </SidebarFooter>
    </Sidebar>
  );
}
