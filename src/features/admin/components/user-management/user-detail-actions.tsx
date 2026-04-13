"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil } from "lucide-react";
import { useUpdateAdminUser } from "@/features/admin/hooks/use-admin-mutations";
import type { UserStatus, UserType } from "@/dal/types";

const STATUS_OPTIONS: UserStatus[] = [
  "pending_verification",
  "email_verified",
  "incomplete_profile",
  "active",
  "inactive",
  "suspended",
];

const TYPE_OPTIONS: UserType[] = ["standard", "admin", "superadmin"];

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

interface UserDetailActionsProps {
  userId: string;
  currentStatus: UserStatus;
  currentUserType: UserType;
}

export function UserDetailActions({
  userId,
  currentStatus,
  currentUserType,
}: UserDetailActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<UserStatus>(currentStatus);
  const [selectedUserType, setSelectedUserType] =
    useState<UserType>(currentUserType);
  const { mutate, isPending } = useUpdateAdminUser();

  const hasChanges =
    selectedStatus !== currentStatus || selectedUserType !== currentUserType;

  const handleOpen = () => {
    setSelectedStatus(currentStatus);
    setSelectedUserType(currentUserType);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (!isPending) {
      setIsOpen(false);
    }
  };

  const handleSave = () => {
    const updates: {
      userId: string;
      status?: UserStatus;
      userType?: UserType;
    } = { userId };

    if (selectedStatus !== currentStatus) {
      updates.status = selectedStatus;
    }
    if (selectedUserType !== currentUserType) {
      updates.userType = selectedUserType;
    }

    mutate(updates, {
      onSuccess: () => {
        setIsOpen(false);
      },
    });
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Status:</span>
            <Badge variant="outline" className="capitalize">
              {formatStatus(currentStatus)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Role:</span>
            <Badge variant="outline" className="capitalize">
              {currentUserType}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update user</DialogTitle>
            <DialogDescription>
              Change the user&apos;s status or role. Review your changes before
              saving.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={selectedStatus}
                onValueChange={(v) => setSelectedStatus(v as UserStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatStatus(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStatus !== currentStatus && (
                <p className="text-muted-foreground text-xs">
                  {formatStatus(currentStatus)} &rarr;{" "}
                  <span className="text-foreground font-medium">
                    {formatStatus(selectedStatus)}
                  </span>
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={selectedUserType}
                onValueChange={(v) => setSelectedUserType(v as UserType)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUserType !== currentUserType && (
                <p className="text-muted-foreground text-xs">
                  {currentUserType} &rarr;{" "}
                  <span className="text-foreground font-medium">
                    {selectedUserType}
                  </span>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
