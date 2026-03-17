"use client";

import { useState } from "react";
import { XCircle, Loader2 } from "lucide-react";

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

interface CancelRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  listingName: string;
  onSuccess?: () => void;
}

export function CancelRequestDialog({
  open,
  onOpenChange,
  requestId,
  listingName,
  onSuccess,
}: CancelRequestDialogProps) {
  const [reason, setReason] = useState("");
  const cancelMutation = useCancelRentalRequest();

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Cancel Request
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel your rental request for{" "}
            {listingName}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cancel-request-reason">
              Reason for cancellation (required)
            </Label>
            <Textarea
              id="cancel-request-reason"
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
            Keep Request
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
              "Cancel Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
