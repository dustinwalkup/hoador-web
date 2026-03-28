"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ListingManageDeleteConfig {
  title: string;
  description: string;
  buttonLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onConfirm: () => void | Promise<void>;
}

interface ListingManageDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description: string;
  listingName: string;
  statusDescription: string;
  statusIcon: LucideIcon;
  statusBadge: React.ReactNode;
  children?: React.ReactNode;
  footerActions: React.ReactNode;
  deleteConfig?: ListingManageDeleteConfig;
}

export function ListingManageDialogShell({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  listingName,
  statusDescription,
  statusIcon: StatusIcon,
  statusBadge,
  children,
  footerActions,
  deleteConfig,
}: ListingManageDialogShellProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Manage</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-3">
              <StatusIcon className="h-5 w-5" />
              <div>
                <h3 className="font-medium">{listingName}</h3>
                <p className="text-muted-foreground text-sm">
                  {statusDescription}
                </p>
              </div>
            </div>
            {statusBadge}
          </div>

          {children}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {deleteConfig ? (
            <div className="w-full border-t pt-4 sm:w-auto sm:border-t-0 sm:pt-0">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteConfig.isPending}
                className="w-full sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteConfig.isPending
                  ? deleteConfig.pendingLabel
                  : deleteConfig.buttonLabel}
              </Button>
            </div>
          ) : null}
          {footerActions}
        </DialogFooter>

        {deleteConfig ? (
          <AlertDialog
            open={showDeleteConfirm}
            onOpenChange={setShowDeleteConfirm}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <div className="rounded-full bg-red-100 p-2">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </div>
                  {deleteConfig.title}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                  {deleteConfig.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteConfig.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void deleteConfig.onConfirm();
                  }}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteConfig.isPending}
                >
                  {deleteConfig.isPending
                    ? deleteConfig.pendingLabel
                    : deleteConfig.buttonLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
