"use client";

import { useState } from "react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [returnInstructions, setReturnInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await approveRentalRequest({
        requestId,
        pickupInstructions: pickupInstructions || undefined,
        returnInstructions: returnInstructions || undefined,
      });

      if (result.success) {
        onOpenChange(false);
        setPickupInstructions("");
        setReturnInstructions("");
        onSuccess?.();
      } else {
        setError(result.error || "Something went wrong");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setPickupInstructions("");
    setReturnInstructions("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Approve Rental Request
          </DialogTitle>
          <DialogDescription>
            You&apos;re about to approve {renterName}&apos;s request to rent
            your <strong>{toolName}</strong>. You can provide pickup and return
            instructions to help coordinate the rental.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pickup-instructions">
              Pickup Instructions (Optional)
            </Label>
            <Textarea
              id="pickup-instructions"
              placeholder="Provide details about when and where the renter can pick up the tool..."
              value={pickupInstructions}
              onChange={(e) => setPickupInstructions(e.target.value)}
              className="min-h-20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="return-instructions">
              Return Instructions (Optional)
            </Label>
            <Textarea
              id="return-instructions"
              placeholder="Provide details about when and where the tool should be returned..."
              value={returnInstructions}
              onChange={(e) => setReturnInstructions(e.target.value)}
              className="min-h-20"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
