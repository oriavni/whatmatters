import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Minimal header */}
      <header className="h-14 flex items-center justify-center border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Link
          href="/"
          className="font-semibold text-sm tracking-tight hover:opacity-80 transition-opacity"
        >
          WhatMatters
        </Link>
      </header>

      {/* Centered card */}
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>

      {/* Footer */}
      <footer className="h-10 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} WhatMatters
        </p>
      </footer>
    </div>
  );
}
