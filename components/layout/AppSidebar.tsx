"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Archive,
  Headphones,
  Radio,
  Compass,
  Settings,
  Lock,
  Zap,
} from "lucide-react"

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
} from "@/components/ui/sidebar"
import { UserNav } from "./UserNav"
import { Logo } from "@/components/brand/Logo"

const navItems = [
  { label: "Brief",        href: "/app/brief",        icon: BookOpen,   premiumOnly: false },
  { label: "Archive",      href: "/app/archive",      icon: Archive,    premiumOnly: false },
  { label: "Audio Briefs", href: "/app/audio-briefs", icon: Headphones, premiumOnly: true  },
  { label: "Sources",      href: "/app/sources",      icon: Radio,      premiumOnly: false },
  { label: "Discover",     href: "/app/discover",     icon: Compass,    premiumOnly: false },
  { label: "Preferences",  href: "/app/preferences",  icon: Settings,   premiumOnly: false },
] as const

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userEmail: string
  isPremium: boolean
}

export function AppSidebar({ userEmail, isPremium, ...props }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/app/brief">
                <Logo size="md" className="group-data-[collapsible=icon]:hidden" />
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
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)
                const locked = item.premiumOnly && !isPremium
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
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
  )
}
