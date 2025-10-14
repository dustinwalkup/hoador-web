"use client";

import { useTransition } from "react";
import { PlayCircle, Loader2 } from "lucide-react";
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

import { startRental } from "@/features/rentals/actions/start-rental";

interface StartRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  listingName: string;
  renterName: string;
  onSuccess?: () => void;
}

export function StartRentalDialog({
  open,
  onOpenChange,
  rentalId,
  listingName,
  renterName,
  onSuccess,
}: StartRentalDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleStartRental = async () => {
    startTransition(async () => {
      try {
        const result = await startRental(rentalId);

        if (result.success) {
          // Close dialog and trigger success callback
          onOpenChange(false);
          onSuccess?.();
          toast.success("Rental started successfully!", {
            description: `The rental for ${listingName} is now active. ${renterName} has been notified.`,
          });
        } else {
          toast.error("Failed to start rental", {
            description: result.error || "Please try again.",
          });
        }
      } catch (error) {
        // Show error toast if the action fails
        toast.error("Failed to start rental", {
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
            <PlayCircle className="text-primary h-5 w-5" />
            Start Rental
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to start the rental for {listingName} with{" "}
            {renterName}? This will mark the rental as active.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h4 className="mb-2 font-semibold text-green-900">
              What happens next:
            </h4>
            <ul className="space-y-1 text-sm text-green-800">
              <li>• The rental status will change to &quot;Active&quot;</li>
              <li>• {renterName} will receive an email notification</li>
              <li>• The rental period officially begins</li>
              <li>• You can end the rental anytime while it&apos;s active</li>
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
            onClick={handleStartRental}
            disabled={isPending}
            className=""
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Rental
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
