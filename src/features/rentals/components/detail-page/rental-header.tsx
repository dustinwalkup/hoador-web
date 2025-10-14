import { Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RentalDetails } from "@/dal/rentals.dal";
import { BackButton } from "@/components/back-button";

interface RentalHeaderProps {
  rentalDetails: Pick<
    RentalDetails,
    "id" | "status" | "createdAt" | "totalAmount"
  >;
  viewContext: "renting" | "lending" | "auto";
  isRenter: boolean;
  isOwner: boolean;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-5 w-5 text-yellow-600" />;
    case "approved":
      return <CheckCircle className="h-5 w-5 text-blue-600" />;
    case "active":
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case "completed":
      return <CheckCircle className="h-5 w-5 text-blue-600" />;
    case "denied":
    case "cancelled":
      return <XCircle className="h-5 w-5 text-red-600" />;
    default:
      return <AlertTriangle className="h-5 w-5 text-gray-600" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-blue-100 text-blue-800";
    case "active":
      return "bg-green-100 text-green-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "denied":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function RentalHeader({ rentalDetails }: RentalHeaderProps) {
  return (
    <div className="flex flex-row items-center justify-between gap-4">
      <BackButton />
      <div className="mb-4 flex items-center gap-2">
        {getStatusIcon(rentalDetails.status)}
        <Badge
          className={getStatusColor(rentalDetails.status)}
          variant="secondary"
        >
          {rentalDetails.status.charAt(0).toUpperCase() +
            rentalDetails.status.slice(1)}
        </Badge>
      </div>
    </div>
  );
}
