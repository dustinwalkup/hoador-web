"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { cancelRentalRequestAction } from "@/features/rentals/actions";
import { rentalKeys } from "@/features/rentals/hooks/use-rentals";

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
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const handleCancel = async () => {
    startTransition(async () => {
      try {
        const result = await cancelRentalRequestAction(requestId);

        if (result.success) {
          // Invalidate queries to refresh the data
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: rentalKeys.detail(requestId),
            }),
            queryClient.invalidateQueries({
              queryKey: rentalKeys.rentingByStatus("requests-pending"),
            }),
            queryClient.invalidateQueries({
              queryKey: rentalKeys.rentingByStatus("requests-denied"),
            }),
          ]);

          // Close dialog and trigger success callback
          onOpenChange(false);
          onSuccess?.();
          toast.success("Request cancelled successfully!", {
            description: "Your rental request has been cancelled.",
          });
        } else {
          // Show error toast if the action fails
          toast.error("Failed to cancel request", {
            description: result.error || "Please try again.",
          });
        }
      } catch {
        // Show error toast if the action fails
        toast.error("Failed to cancel request", {
          description: "An unexpected error occurred. Please try again.",
        });
      }
    });
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
            disabled={isPending}
          >
            Keep Request
          </Button>
          <Button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            variant="destructive"
          >
            {isPending ? (
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
