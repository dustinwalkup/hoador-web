"use client";

import { PlayCircle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { useStartRental } from "@/features/rentals/hooks/use-rental-mutations";

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
  const startMutation = useStartRental();

  const handleStartRental = async () => {
    try {
      await startMutation.mutateAsync(rentalId);

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
            disabled={startMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleStartRental}
            disabled={startMutation.isPending}
            className=""
          >
            {startMutation.isPending ? (
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
