"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Plus,
  Edit,
  ExternalLink,
  PlayCircle,
  AlertTriangle,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RentalActionsInfo } from "@/dal/rentals.dal";
import type { DisputeWithRelations } from "@/dal/types";
import { CancelRequestDialog } from "@/features/rentals/components/renting-lending/cancel-request-dialog";
import {
  ApproveRequestDialog,
  CancelApprovedRentalDialog,
  DeclineRequestDialog,
  UpdateInstructionsDialog,
  StartRentalDialog,
  EndRentalDialog,
} from "@/features/rentals/components/renting-lending";
import { FileDisputeDialog } from "@/features/disputes/components/file-dispute-dialog";
import { TimeWindowValidation } from "@/features/disputes/lib/time-window-validation";
import { ReviewFormDialog } from "@/features/reviews/components/review-form-dialog";

interface RentalActionsProps {
  rentalDetails: RentalActionsInfo;
  viewContext: "renting" | "lending" | "auto";
  isRenter: boolean;
  isOwner: boolean;
  rentalAgreementUrl?: string;
  disputePolicyUrl?: string;
  activeDispute?: DisputeWithRelations | null;
  canReview?: boolean;
}

export function RentalActions({
  rentalDetails,
  isRenter,
  isOwner,
  rentalAgreementUrl,
  disputePolicyUrl,
  activeDispute,
  canReview: canReviewProp,
}: RentalActionsProps) {
  const router = useRouter();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCancelApprovedDialog, setShowCancelApprovedDialog] =
    useState(false);
  const [cancelApprovedRole, setCancelApprovedRole] = useState<
    "renter" | "owner"
  >("renter");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showUpdateInstructionsDialog, setShowUpdateInstructionsDialog] =
    useState(false);
  const [showStartRentalDialog, setShowStartRentalDialog] = useState(false);
  const [showEndRentalDialog, setShowEndRentalDialog] = useState(false);
  const [showFileDisputeDialog, setShowFileDisputeDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [canReview, setCanReview] = useState(canReviewProp ?? false);

  const startDate = new Date(rentalDetails.startDate);
  const returnConfirmedAt = rentalDetails.returnConfirmedAt
    ? new Date(rentalDetails.returnConfirmedAt)
    : null;
  const now = new Date();

  const canFileDispute = (() => {
    if (!(isRenter || isOwner) || !!activeDispute) return false;

    const status = rentalDetails.status;
    if (status === "approved" && now >= startDate) return true;
    if (status === "active") return true;
    if (status === "completed") {
      if (!returnConfirmedAt) return false;
      return TimeWindowValidation.isDisputeFilingWindowOpen(
        startDate,
        returnConfirmedAt,
        now,
      );
    }
    return false;
  })();

  const handleInstructionsUpdated = () => {
    router.refresh();
  };

  const handleRentalStatusChanged = () => {
    router.refresh();
  };

  const handleDownloadRentalAgreement = () => {
    if (rentalAgreementUrl) {
      // Open in new tab - browser will handle PDF download/display
      window.open(rentalAgreementUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Renter Actions */}
        {isRenter && (
          <>
            {rentalDetails.status === "pending" && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Request
              </Button>
            )}

            {rentalDetails.status === "approved" && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setCancelApprovedRole("renter");
                  setShowCancelApprovedDialog(true);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Rental
              </Button>
            )}

            {rentalDetails.status === "completed" && (
              <>
                <Link
                  href={`/dashboard/listings/${rentalDetails.listingId}/rent`}
                >
                  <Button className="mb-3 w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Rent Again
                  </Button>
                </Link>
              </>
            )}
          </>
        )}

        {/* Owner Actions */}
        {isOwner && (
          <>
            {rentalDetails.status === "pending" && (
              <>
                <Button
                  className="w-full"
                  onClick={() => setShowApproveDialog(true)}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => setShowDeclineDialog(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Decline Request
                </Button>
              </>
            )}

            {rentalDetails.status === "approved" && (
              <Button
                className="w-full"
                onClick={() => setShowStartRentalDialog(true)}
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Rental
              </Button>
            )}

            {rentalDetails.status === "approved" && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setCancelApprovedRole("owner");
                  setShowCancelApprovedDialog(true);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Rental
              </Button>
            )}

            {rentalDetails.status === "active" && (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowEndRentalDialog(true)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                End Rental
              </Button>
            )}

            {(rentalDetails.status === "approved" ||
              rentalDetails.status === "active") && (
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => setShowUpdateInstructionsDialog(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Update Instructions
              </Button>
            )}
          </>
        )}

        {/* Leave Review Action - Available for both renter and owner */}
        {canReview && (
          <Button className="w-full" onClick={() => setShowReviewDialog(true)}>
            <Star className="mr-2 h-4 w-4" />
            Leave a Review
          </Button>
        )}

        {/* File Dispute Action - Available for both renter and owner */}
        {canFileDispute && (
          <Button
            variant="outline"
            className="w-full border-orange-200 bg-transparent text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20"
            onClick={() => setShowFileDisputeDialog(true)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            File Dispute
          </Button>
        )}

        {/* Common Actions */}
        <Button
          variant="outline"
          className="w-full bg-transparent"
          onClick={handleDownloadRentalAgreement}
          disabled={!rentalAgreementUrl}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Rental Agreement
        </Button>
      </CardContent>

      {/* Cancel Request Dialog (pending only) */}
      <CancelRequestDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        requestId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        onSuccess={handleRentalStatusChanged}
      />

      {/* Cancel Approved Rental Dialog */}
      <CancelApprovedRentalDialog
        open={showCancelApprovedDialog}
        onOpenChange={setShowCancelApprovedDialog}
        requestId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        startDate={rentalDetails.startDate}
        role={cancelApprovedRole}
        onSuccess={handleRentalStatusChanged}
      />

      {/* Approve Request Dialog */}
      <ApproveRequestDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        requestId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        renterName={rentalDetails.renterName}
        deliveryRequested={rentalDetails.deliveryRequested}
      />

      {/* Decline Request Dialog */}
      <DeclineRequestDialog
        open={showDeclineDialog}
        onOpenChange={setShowDeclineDialog}
        requestId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        renterName={rentalDetails.renterName}
      />

      {/* Update Instructions Dialog */}
      <UpdateInstructionsDialog
        open={showUpdateInstructionsDialog}
        onOpenChange={setShowUpdateInstructionsDialog}
        rentalId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        currentPickupInstructions={rentalDetails.pickupInstructions}
        currentReturnInstructions={rentalDetails.returnInstructions}
        onSuccess={handleInstructionsUpdated}
      />

      {/* Start Rental Dialog */}
      <StartRentalDialog
        open={showStartRentalDialog}
        onOpenChange={setShowStartRentalDialog}
        rentalId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        renterName={rentalDetails.renterName}
        onSuccess={handleRentalStatusChanged}
      />

      {/* End Rental Dialog */}
      <EndRentalDialog
        open={showEndRentalDialog}
        onOpenChange={setShowEndRentalDialog}
        rentalId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        renterName={rentalDetails.renterName}
        onSuccess={handleRentalStatusChanged}
      />

      {/* Review Dialog */}
      <ReviewFormDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        rentalId={rentalDetails.id}
        onSuccess={() => {
          setCanReview(false);
          router.refresh();
        }}
      />

      {/* File Dispute Dialog */}
      <FileDisputeDialog
        open={showFileDisputeDialog}
        onOpenChange={setShowFileDisputeDialog}
        rentalId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        disputePolicyUrl={disputePolicyUrl}
        rentalStatus={rentalDetails.status}
        startDate={startDate}
      />
    </Card>
  );
}
