"use client"

import { signout } from "@/app/actions/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChevronsUpDown, LogOut, Settings, UserCircle, Zap } from "lucide-react"
import Link from "next/link"

interface UserNavProps {
  email: string
  isPremium: boolean
  plan?: string
}

function getInitials(email: string): string {
  const local = email.split("@")[0]
  const parts = local.split(/[._-]/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

export function UserNav({ email, isPremium, plan = "free" }: UserNavProps) {
  const initials = getInitials(email)
  const { isMobile } = useSidebar()
  const planLabel = plan === "premium" ? "Premium" : plan === "pro" ? "Pro" : "Free plan"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{email}</span>
                <span className={`truncate text-xs ${isPremium ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {planLabel}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{email}</span>
                  <span className={`truncate text-xs ${isPremium ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {planLabel}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/app/account">
                  <UserCircle />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/preferences">
                  <Settings />
                  Preferences
                </Link>
              </DropdownMenuItem>
              {!isPremium && (
                <DropdownMenuItem asChild>
                  <Link href="/pricing">
                    <Zap />
                    Upgrade to Pro
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <form action={signout}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
