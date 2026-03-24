"use client";

import { signout } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
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
          <AvatarFallback className="text-[10px] font-medium">
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
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground truncate">
              {email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem>
          <UserCircle />
          <Link href="/app/account" className="flex-1">
            Account
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Settings />
          <Link href="/app/preferences" className="flex-1">
            Preferences
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Use a form so signout works without JS too */}
        <form action={signout}>
          <DropdownMenuItem className="w-full cursor-pointer" aria-label="Sign out">
            <button type="submit" className="flex w-full items-center gap-1.5">
              <LogOut className="size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
