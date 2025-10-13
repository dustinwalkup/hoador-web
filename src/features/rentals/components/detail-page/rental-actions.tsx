"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Flag,
  Plus,
  Edit,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RentalActionsInfo } from "@/dal/rentals.dal";
import { CancelRequestDialog } from "@/features/rentals/components/renting-lending/cancel-request-dialog";
import {
  ApproveRequestDialog,
  DeclineRequestDialog,
} from "@/features/rentals/components/renting-lending";

interface RentalActionsProps {
  rentalDetails: RentalActionsInfo;
  viewContext: "renting" | "lending" | "auto";
  isRenter: boolean;
  isOwner: boolean;
}

export function RentalActions({
  rentalDetails,
  isRenter,
  isOwner,
}: RentalActionsProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
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

            {rentalDetails.status === "active" && (
              <>
                <Button variant="outline" className="w-full bg-transparent">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Request Extension
                </Button>
                <Button variant="outline" className="w-full bg-transparent">
                  <Flag className="mr-2 h-4 w-4" />
                  Report Issue
                </Button>
              </>
            )}

            {rentalDetails.status === "completed" && (
              <Link href={`/listings/${rentalDetails.listingId}/rent`}>
                <Button className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Rent Again
                </Button>
              </Link>
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

            {(rentalDetails.status === "approved" ||
              rentalDetails.status === "active") && (
              <Button variant="outline" className="w-full bg-transparent">
                <Edit className="mr-2 h-4 w-4" />
                Update Instructions
              </Button>
            )}
          </>
        )}

        {/* Common Actions */}
        <Button variant="outline" className="w-full bg-transparent">
          <Download className="mr-2 h-4 w-4" />
          Download Contract
        </Button>
      </CardContent>

      {/* Cancel Request Dialog */}
      <CancelRequestDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        requestId={rentalDetails.id}
        listingName={rentalDetails.listingName}
      />

      {/* Approve Request Dialog */}
      <ApproveRequestDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        requestId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        renterName={rentalDetails.renterName}
      />

      {/* Decline Request Dialog */}
      <DeclineRequestDialog
        open={showDeclineDialog}
        onOpenChange={setShowDeclineDialog}
        requestId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        renterName={rentalDetails.renterName}
      />
    </Card>
  );
}
