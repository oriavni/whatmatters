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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  Bookmark,
  Radio,
  Compass,
  Settings,
} from "lucide-react";
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
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader className="h-12 justify-center border-b">
        <Link
          href="/app/brief"
          className="flex items-center gap-2 px-2 font-semibold text-sm tracking-tight"
        >
          {/* Small dot mark visible in icon-only state */}
          <span className="size-5 shrink-0 rounded-md bg-foreground flex items-center justify-center">
            <span className="text-[0.625rem] font-bold text-background leading-none">W</span>
          </span>
          {!isCollapsed && <span>WhatMatters</span>}
        </Link>
      </SidebarHeader>

      {/* Nav items */}
      <SidebarContent className="pt-2">
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

      {/* User nav footer */}
      <SidebarFooter className="border-t pt-2 pb-3">
        <UserNav email={userEmail} collapsed={isCollapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}
