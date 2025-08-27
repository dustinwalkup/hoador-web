"use client";

import { useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { declineRentalRequest } from "@/features/rentals/actions";

interface DeclineRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  toolName: string;
  renterName: string;
  onSuccess?: () => void;
}

export function DeclineRequestDialog({
  open,
  onOpenChange,
  requestId,
  toolName,
  renterName,
  onSuccess,
}: DeclineRequestDialogProps) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleDecline = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for declining");
      return;
    }

    // Show optimistic toast immediately
    toast.success("Request declined successfully!", {
      description: "The renter has been notified.",
    });

    startTransition(async () => {
      try {
        const result = await declineRentalRequest({
          requestId,
          rejectionReason: reason,
        });

        if (result.success) {
          // Close dialog and trigger success callback
          onOpenChange(false);
          setReason("");
          onSuccess?.();
        } else {
          // Show error toast if the action fails
          toast.error("Failed to decline request", {
            description: result.error || "Please try again.",
          });
        }
      } catch {
        // Show error toast if the action fails
        toast.error("Failed to decline request", {
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
            <XCircle className="h-5 w-5 text-red-600" />
            Decline Request
          </DialogTitle>
          <DialogDescription>
            Decline the rental request for {toolName} from {renterName}. The
            renter will be notified of your decision.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason for declining (required)</Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for declining this request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
              required
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
            onClick={handleDecline}
            disabled={isPending || !reason.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Declining...
              </>
            ) : (
              "Decline Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
