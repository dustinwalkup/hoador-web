import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { RentalStatusInfo } from "@/dal/rentals.dal";
import type { DisputeWithRelations } from "@/dal/types";
import { capitalize } from "@/lib/utils";
import { DisputeStatusBadge } from "@/features/disputes/components/dispute-status-badge";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RentalStatusCardProps {
  rentalDetails: RentalStatusInfo;
  activeDispute?: DisputeWithRelations | null;
}

const getStatusDescription = (status: string) => {
  switch (status) {
    case "pending":
      return "Waiting for owner approval";
    case "approved":
      return "Approved";
    case "active":
      return "Currently in progress";
    case "completed":
      return "Rental completed successfully";
    case "denied":
      return "Request was declined";
    case "cancelled":
      return "Rental was cancelled";
    default:
      return "Status unknown";
  }
};

export function RentalStatusCard({
  rentalDetails,
  activeDispute,
}: RentalStatusCardProps) {
  // Calculate time remaining for evidence deadline if applicable
  const getEvidenceDeadlineInfo = () => {
    if (!activeDispute) return null;

    const deadline =
      activeDispute.status === "evidence_requested"
        ? activeDispute.evidenceDeadline
        : activeDispute.additionalEvidenceDeadline;

    if (!deadline) return null;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    const timeRemaining = deadlineDate.getTime() - now.getTime();

    if (timeRemaining <= 0) return { expired: true, deadline: deadlineDate };

    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );

    return {
      expired: false,
      deadline: deadlineDate,
      days,
      hours,
      timeRemaining,
    };
  };

  const evidenceDeadlineInfo = getEvidenceDeadlineInfo();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="mb-1 text-xl font-semibold">Rental Status</h2>
            <p className="text-gray-600">
              {getStatusDescription(rentalDetails.status)}
            </p>
          </div>
          {activeDispute && (
            <div className="flex flex-col items-end gap-2">
              <DisputeStatusBadge status={activeDispute.status} />
              <Link href={`/dashboard/disputes/${activeDispute.id}`}>
                <Button variant="outline" size="sm">
                  View Dispute
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Dispute Evidence Deadline Warning */}
        {activeDispute && evidenceDeadlineInfo && (
          <div
            className={`mb-4 rounded-md border p-3 ${
              evidenceDeadlineInfo.expired
                ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
            }`}
          >
            <div className="flex items-start gap-2">
              <Clock
                className={`mt-0.5 h-4 w-4 ${
                  evidenceDeadlineInfo.expired
                    ? "text-red-600 dark:text-red-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`}
              />
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    evidenceDeadlineInfo.expired
                      ? "text-red-800 dark:text-red-300"
                      : "text-yellow-800 dark:text-yellow-300"
                  }`}
                >
                  {evidenceDeadlineInfo.expired
                    ? "Evidence deadline expired"
                    : "Evidence deadline approaching"}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    evidenceDeadlineInfo.expired
                      ? "text-red-700 dark:text-red-400"
                      : "text-yellow-700 dark:text-yellow-400"
                  }`}
                >
                  {evidenceDeadlineInfo.expired
                    ? `Deadline was ${evidenceDeadlineInfo.deadline.toLocaleString()}`
                    : `Deadline: ${evidenceDeadlineInfo.deadline.toLocaleString()} (${evidenceDeadlineInfo.days} days, ${evidenceDeadlineInfo.hours} hours remaining)`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-green-600"></div>
            <span className="text-sm">
              Request created:{" "}
              {new Date(rentalDetails.createdAt).toLocaleString()}
            </span>
          </div>
          {rentalDetails.approvedAt && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-600"></div>
              <span className="text-sm">
                Approved: {new Date(rentalDetails.approvedAt).toLocaleString()}
              </span>
            </div>
          )}
          {rentalDetails.actualStartDate && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-600"></div>
              <span className="text-sm">
                Rental started:{" "}
                {new Date(rentalDetails.actualStartDate).toLocaleString()}
              </span>
            </div>
          )}
          {rentalDetails.actualEndDate && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-600"></div>
              <span className="text-sm">
                Rental ended:{" "}
                {new Date(rentalDetails.actualEndDate).toLocaleString()}
              </span>
            </div>
          )}
          {rentalDetails.deniedAt && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-red-600"></div>
                <span className="text-sm">
                  {capitalize(rentalDetails.status)}:{" "}
                  {new Date(rentalDetails.deniedAt).toLocaleString()}
                </span>
              </div>
              {rentalDetails.denialReason && (
                <div className="ml-5 rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-800">
                    <strong>Reason:</strong> {rentalDetails.denialReason}
                  </p>
                </div>
              )}
            </div>
          )}
          {rentalDetails.status === "pending" && (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-gray-300"></div>
              <span className="text-sm text-gray-500">
                Waiting for approval...
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
