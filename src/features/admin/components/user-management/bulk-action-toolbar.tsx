"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Mail, RefreshCw, Loader2 } from "lucide-react";
import { ReengagementDialog } from "./reengagement-dialog";
import type { UserStatus } from "@/dal/types";

export interface BulkActionToolbarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onBulkStatusChange: (userIds: string[], status: UserStatus) => Promise<void>;
  onBulkReengagement: (
    userIds: string[],
    message: string,
    channels: { email: boolean; push: boolean },
  ) => Promise<void>;
}

/**
 * Toolbar shown when users are selected. Supports bulk status change and re-engagement.
 */
export function BulkActionToolbar({
  selectedIds,
  onClearSelection,
  onBulkStatusChange,
  onBulkReengagement,
}: BulkActionToolbarProps) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [reengagementOpen, setReengagementOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const count = selectedIds.size;
  const userIds = Array.from(selectedIds);

  const handleStatusChange = async (status: UserStatus) => {
    setPendingStatus(status);
    setStatusDialogOpen(false);
    setIsSubmitting(true);
    try {
      await onBulkStatusChange(userIds, status);
      onClearSelection();
    } finally {
      setIsSubmitting(false);
      setPendingStatus(null);
    }
  };

  const handleReengagementConfirm = async (
    message: string,
    channels: { email: boolean; push: boolean },
  ) => {
    await onBulkReengagement(userIds, message, channels);
    onClearSelection();
    setReengagementOpen(false);
  };

  if (count === 0) return null;

  return (
    <>
      <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3">
        <span className="text-muted-foreground text-sm">
          <strong className="text-foreground">{count}</strong> user
          {count === 1 ? "" : "s"} selected
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            open={statusDialogOpen}
            onOpenChange={setStatusDialogOpen}
            onValueChange={(v) => {
              if (v) handleStatusChange(v as UserStatus);
            }}
            value=""
          >
            <SelectTrigger className="w-[160px]" disabled={isSubmitting}>
              {isSubmitting && pendingStatus ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Change status
                </>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReengagementOpen(true)}
            disabled={isSubmitting}
          >
            <Mail className="h-4 w-4" />
            Send re-engagement
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear selection
          </Button>
        </div>
      </div>

      <ReengagementDialog
        open={reengagementOpen}
        onOpenChange={setReengagementOpen}
        selectedCount={count}
        onConfirm={handleReengagementConfirm}
      />
    </>
  );
}
