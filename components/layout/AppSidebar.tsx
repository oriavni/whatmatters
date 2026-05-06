"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { BookOpen, Archive, Radio, Compass, Settings, Headphones, Lock, Zap } from "lucide-react";
import { UserNav } from "./UserNav";

const navItems = [
  { label: "Brief",        href: "/app/brief",         icon: BookOpen,   premiumOnly: false },
  { label: "Archive",      href: "/app/archive",       icon: Archive,    premiumOnly: false },
  { label: "Audio Briefs", href: "/app/audio-briefs",  icon: Headphones, premiumOnly: true  },
  { label: "Sources",      href: "/app/sources",       icon: Radio,      premiumOnly: false },
  { label: "Discover",     href: "/app/discover",      icon: Compass,    premiumOnly: false },
  { label: "Preferences",  href: "/app/preferences",   icon: Settings,   premiumOnly: false },
] as const;

interface AppSidebarProps {
  userEmail: string;
  isPremium: boolean;
}

export function AppSidebar({ userEmail, isPremium }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/app/brief">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-foreground text-background">
                  <span className="text-[0.625rem] font-bold leading-none">W</span>
                </div>
                <span className="font-semibold text-sm tracking-tight">WhatMatters</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                const locked = item.premiumOnly && !isPremium;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={locked ? `${item.label} — Pro` : item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                        {locked && (
                          <Lock className="ml-auto size-3 text-muted-foreground/60 shrink-0" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Upgrade nudge for free users */}
        {!isPremium && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Upgrade to Pro">
                    <Link href="/pricing">
                      <Zap />
                      <span>Upgrade to Pro</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <UserNav email={userEmail} isPremium={isPremium} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
