"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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
  const { mutate, isPending } = useUpdateAdminUser();

  const handleStatusChange = (value: UserStatus) => {
    mutate({ userId, status: value });
  };

  const handleUserTypeChange = (value: UserType) => {
    mutate({ userId, userType: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Status</Label>
        <Select
          value={currentStatus}
          onValueChange={(v) => handleStatusChange(v as UserStatus)}
          disabled={isPending}
        >
          <SelectTrigger className="w-[200px]">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Role</Label>
        <Select
          value={currentUserType}
          onValueChange={(v) => handleUserTypeChange(v as UserType)}
          disabled={isPending}
        >
          <SelectTrigger className="w-[200px]">
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
