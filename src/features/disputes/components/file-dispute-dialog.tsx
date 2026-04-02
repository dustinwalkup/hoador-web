"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateDisputeFormContent } from "@/features/disputes/components/";

interface FileDisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  listingName?: string;
  disputePolicyUrl?: string;
  rentalStatus?: string;
  startDate?: Date;
}

/**
 * Dialog component for filing a dispute
 * Uses the form content without the Card wrapper for cleaner dialog presentation
 * Note: The form's hook will navigate to dispute details on success, which will close this dialog
 */
export function FileDisputeDialog({
  open,
  onOpenChange,
  rentalId,
  listingName,
  disputePolicyUrl,
  rentalStatus,
  startDate,
}: FileDisputeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scrollbar-hover-reveal max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>File a Dispute</DialogTitle>
          <DialogDescription>
            {listingName
              ? `Please provide details about the issue with your rental of ${listingName}`
              : "Please provide details about the issue with this rental"}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <CreateDisputeFormContent
            rentalId={rentalId}
            disputePolicyUrl={disputePolicyUrl}
            rentalStatus={rentalStatus}
            startDate={startDate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
