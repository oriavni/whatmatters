"use client";

/**
 * UpgradeButton — initiates a Creem checkout session for a given plan.
 *
 * POSTs to /api/billing/checkout, then redirects the user to the
 * returned Creem checkout URL. No secrets are exposed client-side.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface UpgradeButtonProps extends Omit<ButtonProps, "onClick" | "disabled"> {
  plan: "pro" | "premium";
  label?: string;
}

export function UpgradeButton({
  plan,
  label,
  children,
  className,
  ...rest
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        // Keep loading=true — page is navigating away
      } else {
        setError("No checkout URL returned. Please try again.");
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      // Only clear loading if we're NOT navigating away (i.e., an error occurred)
      setLoading((prev) => {
        if (error !== null) return false;
        return prev; // stay true while navigating
      });
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        onClick={handleClick}
        disabled={loading}
        className={className}
        {...rest}
      >
        {loading ? "Redirecting to checkout…" : (children ?? label ?? "Upgrade")}
      </Button>
      {error && (
        <p className="text-xs text-destructive leading-snug">{error}</p>
      )}
    </div>
  );
}
