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
import type { RentalActionsInfo } from "@/lib/dal/rentals.dal";

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
              <Button variant="destructive" className="w-full">
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
              <Link href={`/tools/${rentalDetails.toolId}/rent`}>
                <Button className="w-full bg-green-600 hover:bg-green-700">
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
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Review & Approve
                </Button>
                <Button variant="outline" className="w-full bg-transparent">
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
    </Card>
  );
}
