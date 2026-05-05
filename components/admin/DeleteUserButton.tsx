"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface DeleteUserButtonProps {
  userId: string;
  userEmail: string;
}

export function DeleteUserButton({ userId, userEmail }: DeleteUserButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmed = confirmation.trim().toLowerCase() === userEmail.toLowerCase();

  async function handleDelete() {
    if (!confirmed || isDeleting) return;
    setIsDeleting(true);
    try {
      // Reuse the admin freeze endpoint — freezing is equivalent to deactivation.
      // This immediately blocks all future AI jobs, API routes, and cron deliveries.
      // Any Inngest jobs already in-flight may complete, but no new ones can start.
      const res = await fetch("/api/admin/freeze", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_frozen: true }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      toast.success(`${userEmail} has been deactivated.`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Deactivate
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isDeleting) setOpen(v); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Deactivate this account?</DialogTitle>
            <DialogDescription>
              This will immediately freeze <strong>{userEmail}</strong> — no more
              Briefs, scheduled deliveries, email commands, or AI processing.
              The user&apos;s data is retained. Use the Freeze toggle to reverse this.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="admin-confirm-email" className="text-sm">
              Type <strong className="font-mono">{userEmail}</strong> to confirm
            </Label>
            <Input
              id="admin-confirm-email"
              type="text"
              autoComplete="off"
              placeholder={userEmail}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && confirmed) void handleDelete(); }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setOpen(false); setConfirmation(""); }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!confirmed || isDeleting}
            >
              {isDeleting ? "Deactivating…" : "Yes, deactivate account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
