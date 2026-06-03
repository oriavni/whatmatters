"use client";

/**
 * ManageBillingButton — opens the Creem customer portal.
 *
 * POSTs to /api/billing/portal to get a portal URL, then navigates there.
 * Works for both Pro and Premium subscribers.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

type ManageBillingButtonProps = Omit<ButtonProps, "onClick" | "disabled">;

export function ManageBillingButton({
  children = "Manage billing",
  className,
  ...rest
}: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not open billing portal. Try again.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
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
        {loading ? "Opening portal…" : children}
      </Button>
      {error && (
        <p className="text-xs text-destructive leading-snug">{error}</p>
      )}
    </div>
  );
}
