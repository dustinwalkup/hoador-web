"use client";

import { useState } from "react";
import { Edit, Loader2 } from "lucide-react";

import { useUpdateRentalInstructions } from "@/features/rentals/hooks/use-rental-mutations";
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

interface UpdateInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  listingName: string;
  currentPickupInstructions?: string | null;
  currentReturnInstructions?: string | null;
  /**
   * A delivery has no pickup to describe (the owner brings the item over), so
   * the pickup field is left out, as the approve dialog leaves it out.
   */
  deliveryRequested?: boolean;
  onSuccess?: () => void;
}

export function UpdateInstructionsDialog({
  open,
  onOpenChange,
  rentalId,
  listingName,
  currentPickupInstructions,
  currentReturnInstructions,
  deliveryRequested = false,
  onSuccess,
}: UpdateInstructionsDialogProps) {
  const [pickupInstructions, setPickupInstructions] = useState(
    currentPickupInstructions || "",
  );
  const [returnInstructions, setReturnInstructions] = useState(
    currentReturnInstructions || "",
  );

  const updateMutation = useUpdateRentalInstructions();

  // Update local state when dialog opens with new values
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setPickupInstructions(currentPickupInstructions || "");
      setReturnInstructions(currentReturnInstructions || "");
    }
    onOpenChange(newOpen);
  };

  const handleUpdate = async () => {
    try {
      // Both fields go every time, the hidden pickup one included: the update
      // writes both columns, so leaving one out would blank it.
      await updateMutation.mutateAsync({
        rentalId,
        pickupInstructions: pickupInstructions || undefined,
        returnInstructions: returnInstructions || undefined,
      });

      // Close dialog and trigger success callback
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error toast is already shown by the mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-blue-600" />
            Update Instructions
          </DialogTitle>
          <DialogDescription>
            Update the {deliveryRequested ? "return" : "pickup and return"}{" "}
            instructions for {listingName}. The renter will be notified of any
            changes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {!deliveryRequested && (
            <div className="grid gap-2">
              <Label htmlFor="pickup-instructions">
                Pickup Instructions (Optional)
              </Label>
              <Textarea
                id="pickup-instructions"
                placeholder="Provide details about when and where the renter can pick up the listing..."
                value={pickupInstructions}
                onChange={(e) => setPickupInstructions(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="return-instructions">
              Return Instructions (Optional)
            </Label>
            <Textarea
              id="return-instructions"
              placeholder="Provide details about when and where the renter should return the listing..."
              value={returnInstructions}
              onChange={(e) => setReturnInstructions(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpdate}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Instructions"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
