import type { Metadata } from "next";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata: Metadata = { title: "Auth error" };

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-4">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        We couldn&apos;t sign you in. The link may have expired or already been
        used.
      </p>
      <Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
        Back to sign in
      </Link>
    </div>
  );
}
