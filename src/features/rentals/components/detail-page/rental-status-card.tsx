import { Card, CardContent } from "@/components/ui/card";
import type { RentalStatusInfo } from "@/dal/rentals.dal";
import { capitalize } from "@/lib/utils";

interface RentalStatusCardProps {
  rentalDetails: RentalStatusInfo;
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

export function RentalStatusCard({ rentalDetails }: RentalStatusCardProps) {
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
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              ${parseFloat(rentalDetails.totalAmount).toFixed(2)}
            </div>
            <p className="text-sm text-gray-600">Total amount</p>
          </div>
        </div>

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
