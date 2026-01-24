"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useApproveListing,
  useRejectListing,
} from "@/features/admin/hooks/use-admin-mutations";
import { toast } from "sonner";

interface ApproveRejectDialogProps {
  listingId: string;
  listingName: string;
  action: "approve" | "reject";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApproveRejectDialog({
  listingId,
  listingName,
  action,
  open,
  onOpenChange,
}: ApproveRejectDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const approveMutation = useApproveListing();
  const rejectMutation = useRejectListing();

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  const handleClose = () => {
    if (!isPending) {
      setRejectionReason("");
      setValidationError(null);
      onOpenChange(false);
    }
  };

  const handleSubmit = async () => {
    if (action === "reject") {
      // Validate rejection reason
      if (!rejectionReason.trim()) {
        setValidationError("Rejection reason is required");
        return;
      }

      if (rejectionReason.trim().length < 10) {
        setValidationError(
          "Rejection reason must be at least 10 characters long",
        );
        return;
      }

      if (rejectionReason.trim().length > 1000) {
        setValidationError(
          "Rejection reason must be at most 1000 characters long",
        );
        return;
      }

      setValidationError(null);
    }

    try {
      if (action === "approve") {
        await approveMutation.mutateAsync(listingId, {
          onSuccess: () => {
            handleClose();
            toast.success("Listing approved successfully!", {
              description: `"${listingName}" has been approved and is now live. The owner has been notified.`,
            });
          },
        });
      } else {
        await rejectMutation.mutateAsync(
          {
            listingId,
            rejectionReason: rejectionReason.trim(),
          },
          {
            onSuccess: () => {
              handleClose();
              toast.success("Listing rejected successfully!", {
                description: `"${listingName}" has been rejected. The owner has been notified with the reason.`,
              });
            },
          },
        );
      }
    } catch (error) {
      // Error is already handled by the mutation hook
      console.error(`Failed to ${action} listing:`, error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "approve" ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Approve Listing
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Reject Listing
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? `Approve "${listingName}" for publication? The listing will be visible to all users and the owner will be notified.`
              : `Reject "${listingName}"? Please provide a reason for rejection. The owner will be notified and can make changes to resubmit.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {action === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="Please provide a detailed reason for rejection (minimum 10 characters)..."
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  setValidationError(null);
                }}
                className={`min-h-[120px] ${
                  validationError ? "border-destructive" : ""
                }`}
                disabled={isPending}
                maxLength={1000}
              />
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>
                  {validationError && (
                    <span className="text-destructive">{validationError}</span>
                  )}
                </span>
                <span>{rejectionReason.length}/1000 characters</span>
              </div>
              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              isPending ||
              (action === "reject" &&
                (!rejectionReason.trim() || rejectionReason.trim().length < 10))
            }
            variant={action === "approve" ? "default" : "destructive"}
            className={
              action === "approve"
                ? "bg-green-600 hover:bg-green-700"
                : undefined
            }
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {action === "approve" ? "Approving..." : "Rejecting..."}
              </>
            ) : (
              <>
                {action === "approve" ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
