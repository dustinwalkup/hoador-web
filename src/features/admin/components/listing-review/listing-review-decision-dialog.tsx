"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

const APPROVE_NOTE_MAX = 2000;

export interface ListingReviewDecisionDialogProps {
  action: "approve" | "reject";
  listingName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  /** When true and action is approve, show optional internal note field (service listings). */
  optionalApproveNote: boolean;
  /** Label used in title/description (e.g. "Listing" or "Service listing"). */
  entityLabel?: string;
  onApprove: (note?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

/**
 * Presentational approve/reject modal for admin listing review. Parent supplies
 * mutations via onApprove/onReject and sets isPending from mutation state.
 */
export function ListingReviewDecisionDialog({
  action,
  listingName,
  open,
  onOpenChange,
  isPending,
  optionalApproveNote,
  entityLabel = "Listing",
  onApprove,
  onReject,
}: ListingReviewDecisionDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // State is reset on close via `handleClose` (avoids setState-in-effect lint).

  const handleClose = () => {
    if (!isPending) {
      setRejectionReason("");
      setApproveNote("");
      setValidationError(null);
      onOpenChange(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      handleClose();
    }
  };

  const handleSubmit = async () => {
    if (action === "reject") {
      if (!rejectionReason.trim()) {
        setValidationError("A reason is required");
        return;
      }

      if (rejectionReason.trim().length < 10) {
        setValidationError("Reason must be at least 10 characters long");
        return;
      }

      if (rejectionReason.trim().length > 1000) {
        setValidationError("Reason must be at most 1000 characters long");
        return;
      }

      setValidationError(null);
      try {
        await onReject(rejectionReason.trim());
      } catch {
        // Parent mutation surfaces errors via toast
      }
      return;
    }

    if (optionalApproveNote && approveNote.trim().length > APPROVE_NOTE_MAX) {
      setValidationError(
        `Internal note must be at most ${APPROVE_NOTE_MAX} characters`,
      );
      return;
    }

    setValidationError(null);
    try {
      await onApprove(
        optionalApproveNote ? approveNote.trim() || undefined : undefined,
      );
    } catch {
      // Parent mutation surfaces errors via toast
    }
  };

  const lowerEntity = entityLabel.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === "approve" ? (
              <>
                <CheckCircle2 className="text-primary h-5 w-5" />
                Approve {entityLabel}
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Request Revisions
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? `Approve "${listingName}" for publication? The ${lowerEntity} will be visible to all users and the owner will be notified.`
              : `Request revisions on "${listingName}"? Please provide a reason. The owner will be notified and can make changes to resubmit.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {action === "approve" && optionalApproveNote && (
            <div className="space-y-2">
              <Label htmlFor="approve-note">Internal note (optional)</Label>
              <Input
                id="approve-note"
                value={approveNote}
                onChange={(e) => {
                  setApproveNote(e.target.value);
                  setValidationError(null);
                }}
                disabled={isPending}
                maxLength={APPROVE_NOTE_MAX}
              />
              <p className="text-muted-foreground text-xs">
                {approveNote.length}/{APPROVE_NOTE_MAX} characters
              </p>
              {validationError && action === "approve" && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {action === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="Please provide a detailed reason for the requested revisions (minimum 10 characters)..."
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
                  {validationError && action === "reject" && (
                    <span className="text-destructive">{validationError}</span>
                  )}
                </span>
                <span>{rejectionReason.length}/1000 characters</span>
              </div>
              {validationError && action === "reject" && (
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
                (!rejectionReason.trim() ||
                  rejectionReason.trim().length < 10 ||
                  rejectionReason.trim().length > 1000)) ||
              (action === "approve" &&
                optionalApproveNote &&
                approveNote.trim().length > APPROVE_NOTE_MAX)
            }
            variant="default"
            className={
              action === "approve"
                ? "bg-primary hover:bg-green-700"
                : "bg-amber-500 text-white hover:bg-amber-600"
            }
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {action === "approve" ? "Approving..." : "Submitting..."}
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
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Request Revisions
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
