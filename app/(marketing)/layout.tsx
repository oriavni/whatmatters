import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">

      {/* ── Full-page ambient background ─────────────────────────────────────
          Single static div. Three radial gradients defined in globals.css.
          Gradient centers drift via CSS @property animation (ambient-drift).
          The div itself never moves — no rectangular boundary can appear.
          ─────────────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="ambient-layer pointer-events-none select-none fixed inset-0 -z-10"
      />

      <header className="bg-transparent backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" aria-label="upto. home">
            <Logo size="md" />
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            <a href="/#how-it-works" className="hidden sm:block hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="/#pricing" className="hidden sm:block hover:text-foreground transition-colors">
              Pricing
            </a>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} getupto.io. All rights reserved.</p>
      </footer>
    </div>
  );
}
