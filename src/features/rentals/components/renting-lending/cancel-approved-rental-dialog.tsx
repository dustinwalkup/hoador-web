"use client";

import { useState, useMemo } from "react";
import { XCircle, Loader2, AlertTriangle } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";

import { useCancelRentalRequest } from "@/features/rentals/hooks/use-rental-mutations";

const CANCEL_REASON_MAX_LENGTH = 1000;

interface CancelApprovedRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  listingName: string;
  startDate: Date | string;
  role: "renter" | "owner";
  onSuccess?: () => void;
}

function getPolicyDescription(
  role: "renter" | "owner",
  startDate: Date | string,
): string {
  if (role === "owner") {
    return "The renter will receive a full refund including the service fee. No payout will be issued to you.";
  }

  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const hoursUntilPickup = (start.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntilPickup >= 24) {
    return "You will receive a full refund of the rental price. The service fee is non-refundable.";
  }

  return "You will receive a 50% refund of the rental price. The remaining 50% will be paid to the owner. The service fee is non-refundable.";
}

export function CancelApprovedRentalDialog({
  open,
  onOpenChange,
  requestId,
  listingName,
  startDate,
  role,
  onSuccess,
}: CancelApprovedRentalDialogProps) {
  const [reason, setReason] = useState("");
  const cancelMutation = useCancelRentalRequest();

  const policyDescription = useMemo(
    () => getPolicyDescription(role, startDate),
    [role, startDate],
  );

  const isReasonValid = reason.trim().length > 0;
  const canSubmit = isReasonValid && !cancelMutation.isPending;

  const handleCancel = async () => {
    if (!canSubmit) return;

    try {
      await cancelMutation.mutateAsync({
        rentalId: requestId,
        reason: reason.trim(),
      });
      onOpenChange(false);
      setReason("");
      onSuccess?.();
    } catch {
      // Error toast is already shown by the mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Cancel Approved Rental
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to cancel your approved rental for{" "}
                {listingName}? This action cannot be undone.
              </p>
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mb-1 inline h-4 w-4" />{" "}
                {policyDescription}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cancel-reason">
              Reason for cancellation (required)
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder="Please provide a reason for cancelling..."
              value={reason}
              onChange={(e) =>
                setReason(e.target.value.slice(0, CANCEL_REASON_MAX_LENGTH))
              }
              className="min-h-[100px]"
              maxLength={CANCEL_REASON_MAX_LENGTH}
              required
            />
            <p className="text-muted-foreground text-right text-xs">
              {reason.length}/{CANCEL_REASON_MAX_LENGTH}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cancelMutation.isPending}
          >
            Keep Rental
          </Button>
          <Button
            type="button"
            onClick={handleCancel}
            disabled={!canSubmit}
            variant="destructive"
          >
            {cancelMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel Rental"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
