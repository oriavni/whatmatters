import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Minimal header */}
      <header className="h-14 flex items-center justify-center bg-background/80 backdrop-blur sticky top-0 z-10">
        <Link href="/" aria-label="upto. home" className="hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </Link>
      </header>

      {/* Centered card */}
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>

      {/* Footer */}
      <footer className="h-10 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} getupto.io
        </p>
      </footer>
    </div>
  );
}
