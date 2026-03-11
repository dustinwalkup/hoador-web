"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useDeleteAdminUser } from "@/features/admin/hooks/use-admin-mutations";

interface DeleteUserDialogProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteUserDialog({
  userId,
  userName,
  isOpen,
  onClose,
}: DeleteUserDialogProps) {
  const router = useRouter();
  const [confirmValue, setConfirmValue] = useState("");
  const { mutate, isPending } = useDeleteAdminUser();

  const handleClose = () => {
    setConfirmValue("");
    onClose();
  };

  const handleConfirm = () => {
    mutate(userId, {
      onSuccess: () => {
        router.push("/admin/dashboard/users");
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            This action cannot be undone. The user and all associated data will
            be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          <Label htmlFor="confirm-name">
            Type <span className="font-semibold">{userName}</span> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            placeholder={userName}
            disabled={isPending}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirmValue !== userName || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete user"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
