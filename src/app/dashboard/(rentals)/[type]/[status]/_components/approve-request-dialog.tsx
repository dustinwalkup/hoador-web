"use client";

import { useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveRentalRequest } from "@/lib/actions/approve-rental-request";

interface ApproveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  toolName: string;
  renterName: string;
  onSuccess?: () => void;
}

export function ApproveRequestDialog({
  open,
  onOpenChange,
  requestId,
  toolName,
  renterName,
  onSuccess,
}: ApproveRequestDialogProps) {
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [returnInstructions, setReturnInstructions] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleApprove = async () => {
    // Show optimistic toast immediately
    toast.success("Request approved successfully!", {
      description: "The renter has been notified.",
    });

    startTransition(async () => {
      try {
        const result = await approveRentalRequest({
          requestId,
          pickupInstructions: pickupInstructions || undefined,
          returnInstructions: returnInstructions || undefined,
        });

        if (result.success) {
          // Close dialog and trigger success callback
          onOpenChange(false);
          setPickupInstructions("");
          setReturnInstructions("");
          onSuccess?.();
        } else {
          // Show error toast if the action fails
          toast.error("Failed to approve request", {
            description: result.error || "Please try again.",
          });
        }
      } catch {
        // Show error toast if the action fails
        toast.error("Failed to approve request", {
          description: "Please try again.",
        });
      }
    });
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
            Approve the rental request for {toolName} from {renterName}. The
            renter will be notified of your approval.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="pickup-instructions">
              Pickup Instructions (Optional)
            </Label>
            <Textarea
              id="pickup-instructions"
              placeholder="Provide details about when and where the renter can pick up the tool..."
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
              placeholder="Provide details about when and where the renter should return the tool..."
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
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Approving...
              </>
            ) : (
              "Approve Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
