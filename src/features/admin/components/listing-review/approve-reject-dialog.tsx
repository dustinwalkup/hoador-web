"use client";

import {
  useApproveListing,
  useRejectListing,
} from "@/features/admin/hooks/use-admin-mutations";
import { ListingReviewDecisionDialog } from "./listing-review-decision-dialog";
import { toast } from "sonner";

interface ApproveRejectDialogProps {
  listingId: string;
  listingName: string;
  action: "approve" | "reject";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Rental/tool listing approve/reject modal for admin review.
 */
export function ApproveRejectDialog({
  listingId,
  listingName,
  action,
  open,
  onOpenChange,
}: ApproveRejectDialogProps) {
  const approveMutation = useApproveListing();
  const rejectMutation = useRejectListing();

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  const handleApprove = async () => {
    await approveMutation.mutateAsync(listingId, {
      onSuccess: () => {
        onOpenChange(false);
        toast.success("Listing approved successfully!", {
          description: `"${listingName}" has been approved and is now live. The owner has been notified.`,
        });
      },
    });
  };

  const handleReject = async (reason: string) => {
    await rejectMutation.mutateAsync(
      {
        listingId,
        rejectionReason: reason,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("Revisions requested!", {
            description: `"${listingName}" has been sent back for revisions. The owner has been notified with your feedback.`,
          });
        },
      },
    );
  };

  return (
    <ListingReviewDecisionDialog
      action={action}
      listingName={listingName}
      open={open}
      onOpenChange={onOpenChange}
      isPending={isPending}
      optionalApproveNote={false}
      entityLabel="Listing"
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}
