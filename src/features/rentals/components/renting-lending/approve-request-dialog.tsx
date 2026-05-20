"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";

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

import { useApproveRentalRequest } from "@/features/rentals/hooks/use-rental-mutations";
interface ApproveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  listingName: string;
  renterName: string;
  deliveryRequested?: boolean;
  onSuccess?: () => void;
}

export function ApproveRequestDialog({
  open,
  onOpenChange,
  requestId,
  listingName,
  renterName,
  deliveryRequested,
  onSuccess,
}: ApproveRequestDialogProps) {
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [returnInstructions, setReturnInstructions] = useState("");

  const approveMutation = useApproveRentalRequest();
  const router = useRouter();

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({
        rentalId: requestId,
        pickupInstructions:
          deliveryRequested === true
            ? undefined
            : pickupInstructions || undefined,
        returnInstructions:
          deliveryRequested === true
            ? undefined
            : returnInstructions || undefined,
      });

      // Close dialog and trigger success callback
      onOpenChange(false);
      setPickupInstructions("");
      setReturnInstructions("");
      onSuccess?.();
    } catch (error) {
      // Server gated the accept because the owner's Stripe Connect isn't ready.
      // Send them straight into the JIT onboarding flow, preserving where they
      // came from so we can return them here on completion.
      if (
        error !== null &&
        typeof error === "object" &&
        (error as { code?: string }).code === "PAYMENT_SETUP_REQUIRED"
      ) {
        const returnTo = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        router.push(
          `/dashboard/payments/earnings-and-payouts?returnTo=${returnTo}`,
        );
        return;
      }
      // Error toast is already shown by the mutation hook's onError handler.
      // Close the dialog since the approval attempt is complete.
      onOpenChange(false);
      setPickupInstructions("");
      setReturnInstructions("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Approve Request
          </DialogTitle>
          <DialogDescription>
            Approve the rental request for {listingName} from {renterName}. The
            renter&apos;s payment method will be charged, and they will be
            notified of your approval.
          </DialogDescription>
        </DialogHeader>
        {deliveryRequested !== true && (
          <div className="grid gap-4 py-4">
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
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={approveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApprove}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              "Approve & Charge Payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
