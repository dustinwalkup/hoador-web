"use client";

import {
  useApproveServiceListing,
  useRejectServiceListing,
} from "@/features/admin/hooks/use-admin-mutations";
import { ListingReviewDecisionDialog } from "./listing-review-decision-dialog";
import { toast } from "sonner";

interface ServiceListingApproveRejectDialogProps {
  listingId: string;
  listingName: string;
  action: "approve" | "reject";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful approve or reject (e.g. router.refresh for RSC pending list). */
  onMutationSuccess?: () => void;
}

/**
 * HOA service listing approve/reject modal for admin review (optional internal note on approve).
 */
export function ServiceListingApproveRejectDialog({
  listingId,
  listingName,
  action,
  open,
  onOpenChange,
  onMutationSuccess,
}: ServiceListingApproveRejectDialogProps) {
  const approveMutation = useApproveServiceListing();
  const rejectMutation = useRejectServiceListing();

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  const handleApprove = async (note?: string) => {
    await approveMutation.mutateAsync(
      { listingId, note },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("Listing approved successfully!", {
            description: `"${listingName}" has been approved and is now live. The owner has been notified.`,
          });
          onMutationSuccess?.();
        },
      },
    );
  };

  const handleReject = async (reason: string) => {
    await rejectMutation.mutateAsync(
      { listingId, reason },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("Revisions requested!", {
            description: `"${listingName}" has been sent back for revisions. The owner has been notified with your feedback.`,
          });
          onMutationSuccess?.();
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
      optionalApproveNote={action === "approve"}
      entityLabel="Service listing"
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}
