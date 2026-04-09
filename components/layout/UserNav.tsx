"use client";

import { signout } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { LogOut, Settings, UserCircle } from "lucide-react";
import Link from "next/link";

interface UserNavProps {
  email: string;
  /** Whether the sidebar is in collapsed (icon-only) state */
  collapsed?: boolean;
}

function getInitials(email: string): string {
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function UserNav({ email, collapsed }: UserNavProps) {
  const initials = getInitials(email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="User menu"
      >
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback className="text-[0.625rem] font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <span className="flex-1 truncate text-xs text-sidebar-foreground/80">
            {email}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="text-xs font-medium text-foreground truncate">
              {email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/app/account" />}>
          <UserCircle />
          Account
        </DropdownMenuItem>

        <DropdownMenuItem render={<Link href="/app/preferences" />}>
          <Settings />
          Preferences
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* form action so signout works without JS too */}
        <form action={signout}>
          <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
