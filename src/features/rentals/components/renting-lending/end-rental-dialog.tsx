"use client";

import { useTransition } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
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

import { endRental } from "@/features/rentals/actions/end-rental";

interface EndRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  listingName: string;
  renterName: string;
  onSuccess?: () => void;
}

export function EndRentalDialog({
  open,
  onOpenChange,
  rentalId,
  listingName,
  renterName,
  onSuccess,
}: EndRentalDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleEndRental = async () => {
    startTransition(async () => {
      try {
        const result = await endRental(rentalId);

        if (result.success) {
          // Close dialog and trigger success callback
          onOpenChange(false);
          onSuccess?.();
          toast.success("Rental ended successfully!", {
            description: `The rental for ${listingName} is now completed. ${renterName} has been notified.`,
          });
        } else {
          toast.error("Failed to end rental", {
            description: result.error || "Please try again.",
          });
        }
      } catch (error) {
        // Show error toast if the action fails
        toast.error("Failed to end rental", {
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
            <CheckCircle className="h-5 w-5 text-blue-600" />
            End Rental
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to end the rental for {listingName} with{" "}
            {renterName}? This will mark the rental as completed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-2 font-semibold text-blue-900">
              What happens next:
            </h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• The rental status will change to &quot;Completed&quot;</li>
              <li>• {renterName} will receive an email notification</li>
              <li>• Both parties can leave reviews</li>
              <li>
                • The security deposit will be processed according to terms
              </li>
            </ul>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="mb-2 font-semibold text-amber-900">
              ⚠️ Before ending:
            </h4>
            <ul className="space-y-1 text-sm text-amber-800">
              <li>• Verify the item has been returned</li>
              <li>• Check the item&apos;s condition</li>
              <li>• Document any damage with photos</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleEndRental}
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ending...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                End Rental
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
