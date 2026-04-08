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
  /** Rental dispute */
  rentalId?: string;
  /** Service booking dispute */
  serviceBookingId?: string;
  /** Required when `serviceBookingId` is set */
  serviceFilerRole?: "requester" | "provider";
  listingName?: string;
  disputePolicyUrl?: string;
  rentalStatus?: string;
  startDate?: Date;
}

/**
 * Dialog component for filing a dispute (rental or service booking).
 */
export function FileDisputeDialog({
  open,
  onOpenChange,
  rentalId,
  serviceBookingId,
  serviceFilerRole,
  listingName,
  disputePolicyUrl,
  rentalStatus,
  startDate,
}: FileDisputeDialogProps) {
  const isService = Boolean(serviceBookingId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scrollbar-hover-reveal max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>File a Dispute</DialogTitle>
          <DialogDescription>
            {isService && listingName
              ? `Please provide details about the issue with your service booking: ${listingName}`
              : listingName
                ? `Please provide details about the issue with your rental of ${listingName}`
                : "Please provide details about the issue with this transaction"}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <CreateDisputeFormContent
            rentalId={rentalId}
            serviceBookingId={serviceBookingId}
            serviceFilerRole={serviceFilerRole}
            disputePolicyUrl={disputePolicyUrl}
            rentalStatus={rentalStatus}
            startDate={startDate}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
