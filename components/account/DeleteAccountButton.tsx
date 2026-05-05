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

interface DeleteAccountButtonProps {
  email: string;
}

export function DeleteAccountButton({ email }: DeleteAccountButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmed = confirmation.trim().toLowerCase() === email.toLowerCase();

  async function handleDelete() {
    if (!confirmed || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      // Session is ended server-side — redirect to home
      toast.success("Your account has been deactivated.");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
        Delete account
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!isDeleting) setOpen(v); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This will immediately deactivate your account. Your sources, digest
              history, and preferences will no longer be accessible. This action
              cannot be undone from the app — contact support if you change your
              mind.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-email" className="text-sm">
              Type <strong className="font-mono">{email}</strong> to confirm
            </Label>
            <Input
              id="confirm-email"
              type="text"
              autoComplete="off"
              placeholder={email}
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
              {isDeleting ? "Deactivating…" : "Yes, delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
