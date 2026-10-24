"use client";

import { useEffect, useState } from "react";
import { XCircle, Loader2, AlertTriangle } from "lucide-react";

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

import { useCancelRentalRequest } from "@/features/rentals/hooks/use-rental-mutations";
import {
  useRentalCancellationPreview,
  type RentalCancellationPreview,
} from "@/features/rentals/hooks/use-rentals";
import { formatDateTimeLocal } from "@/lib/utils/date.utils";

const CANCEL_REASON_MAX_LENGTH = 1000;

/**
 * How long after `tierExpiresAt` the quote is asked for again. At the boundary
 * itself the server still quotes the old tier (it is "at least 24 hours"), so
 * asking a moment later is what gets the new one.
 */
const TIER_EXPIRY_GRACE_MS = 1000;
/** `setTimeout` fires at once past this, so a later expiry arms no timer. */
const MAX_TIMER_MS = 2 ** 31 - 1;

interface CancelApprovedRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  listingName: string;
  onSuccess?: () => void;
}

/**
 * The refund the SERVER will apply, in words (Req 9.3.1).
 *
 * This used to be worked out here from `startDate` and the browser's clock, 24
 * hours before the instant the stored day parsed to. The server measures from
 * the start of the pickup day in Central, so for hours every evening the dialog
 * promised one tier and the cancellation applied the other (HOA-124). The tier
 * now comes from the same preview the mobile app shows.
 */
function getPolicyDescription(preview: RentalCancellationPreview): string {
  switch (preview.tier) {
    case "owner_cancellation":
      return "The renter will receive a full refund including the service fee. No payout will be issued to you.";
    case "full_refund_24h":
      return "You will receive a full refund of the rental price. The service fee is non-refundable.";
    case "half_refund_under_24h":
      return "You will receive a 50% refund of the rental price. The remaining 50% will be paid to the owner. The service fee is non-refundable.";
    default:
      return preview.reason ?? "This rental can't be cancelled right now.";
  }
}

export function CancelApprovedRentalDialog({
  open,
  onOpenChange,
  requestId,
  listingName,
  onSuccess,
}: CancelApprovedRentalDialogProps) {
  const [reason, setReason] = useState("");
  const cancelMutation = useCancelRentalRequest();
  const preview = useRentalCancellationPreview(requestId, open);
  // The quote is a snapshot of a tier that changes at a cutoff. While a fresh
  // one is on its way (every open, and when the tier expires) the last one is
  // not shown and cannot be confirmed against: reopening across the cutoff
  // used to show the old "full refund" with Confirm already live.
  const quote = preview.isFetching ? undefined : preview.data;

  // Ask again when the quoted tier stops being true while the dialog is open.
  const expiresAt = open ? (quote?.tierExpiresAt ?? null) : null;
  const { refetch } = preview;
  useEffect(() => {
    if (!expiresAt) return;
    const delay = Date.parse(expiresAt) - Date.now() + TIER_EXPIRY_GRACE_MS;
    if (!(delay < MAX_TIMER_MS)) return;
    const timer = setTimeout(() => void refetch(), Math.max(delay, 0));
    return () => clearTimeout(timer);
  }, [expiresAt, refetch]);

  const isReasonValid = reason.trim().length > 0;
  // No tier on screen, no confirm: cancelling without showing the refund first
  // is what Req 9.3.1 exists to prevent.
  const canSubmit =
    isReasonValid && !cancelMutation.isPending && quote?.canCancel === true;

  const handleCancel = async () => {
    if (!canSubmit) return;

    try {
      await cancelMutation.mutateAsync({
        rentalId: requestId,
        reason: reason.trim(),
      });
      onOpenChange(false);
      setReason("");
      onSuccess?.();
    } catch {
      // Error toast is already shown by the mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Cancel Approved Rental
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to cancel your approved rental for{" "}
                {listingName}? This action cannot be undone.
              </p>
              <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                {quote ? (
                  <>
                    <p>
                      <AlertTriangle className="mb-1 inline h-4 w-4" />{" "}
                      {getPolicyDescription(quote)}
                    </p>
                    {quote.tierExpiresAt ? (
                      <p className="text-xs">
                        {`This refund applies until ${formatDateTimeLocal(quote.tierExpiresAt)}.`}
                      </p>
                    ) : null}
                  </>
                ) : preview.isError && !preview.isFetching ? (
                  <div className="space-y-2">
                    <p>
                      We couldn&apos;t check your refund just now, so nothing
                      has been cancelled.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void preview.refetch()}
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking your refund…
                  </p>
                )}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="cancel-reason">
              Reason for cancellation (required)
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder="Please provide a reason for cancelling..."
              value={reason}
              onChange={(e) =>
                setReason(e.target.value.slice(0, CANCEL_REASON_MAX_LENGTH))
              }
              className="min-h-[100px]"
              maxLength={CANCEL_REASON_MAX_LENGTH}
              required
            />
            <p className="text-muted-foreground text-right text-xs">
              {reason.length}/{CANCEL_REASON_MAX_LENGTH}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cancelMutation.isPending}
          >
            Keep Rental
          </Button>
          <Button
            type="button"
            onClick={handleCancel}
            disabled={!canSubmit}
            variant="destructive"
          >
            {cancelMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel Rental"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
