"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { declineRentalRequest } from "@/lib/actions/decline-rental-request";

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
  const [isLoading, setIsLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rejectionReason.trim()) {
      setError("Please provide a reason for declining this request");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await declineRentalRequest({
        requestId,
        rejectionReason: rejectionReason.trim(),
      });

      if (result.success) {
        onOpenChange(false);
        setRejectionReason("");
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
    setRejectionReason("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Decline Rental Request
          </DialogTitle>
          <DialogDescription>
            You&apos;re about to decline {renterName}&apos;s request to rent
            your <strong>{toolName}</strong>. Please provide a reason to help
            them understand why their request was declined.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">
              Reason for Declining <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="Please explain why you cannot approve this rental request..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-24"
              required
            />
            <p className="text-xs text-gray-500">
              This will be shared with the renter to help them understand your
              decision.
            </p>
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
            <Button type="submit" disabled={isLoading} variant="destructive">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Declining...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Decline Request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
