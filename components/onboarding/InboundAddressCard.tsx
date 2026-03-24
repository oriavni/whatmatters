"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface InboundAddressCardProps {
  address: string;
}

export function InboundAddressCard({ address }: InboundAddressCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Your Brief address
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Subscribe to any newsletter using this address and it will appear in
          your Brief automatically.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-sm bg-background border rounded px-3 py-2 flex-1 truncate">
          {address}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5 shrink-0"
        >
          {copied ? (
            <Check className="size-3.5 text-green-600" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
