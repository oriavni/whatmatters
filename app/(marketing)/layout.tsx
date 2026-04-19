import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight">WhatMatters</span>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <a href="/login" className="hover:text-foreground transition-colors">
              Sign in
            </a>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} WhatMatters. All rights reserved.</p>
      </footer>
    </div>
  );
}
