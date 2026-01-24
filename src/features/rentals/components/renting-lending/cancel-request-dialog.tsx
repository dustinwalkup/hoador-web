"use client";

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

import { useCancelRentalRequest } from "@/features/rentals/hooks/use-rental-mutations";

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
  const cancelMutation = useCancelRentalRequest();

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(requestId);

      // Close dialog and trigger success callback
      onOpenChange(false);
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
            disabled={cancelMutation.isPending}
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
