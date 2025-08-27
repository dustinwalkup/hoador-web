import { MessageCircle, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RentalMessagesInfo } from "@/dal/rentals.dal";

interface RentalMessagesCardProps {
  rentalDetails: RentalMessagesInfo;
  isRenter: boolean;
  isOwner: boolean;
}

export function RentalMessagesCard({
  rentalDetails,
  isRenter,
  isOwner,
}: RentalMessagesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages & Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rentalDetails.message && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 font-medium">
              <User className="h-4 w-4" />
              Message from {isRenter ? "you" : "renter"}:
            </h4>
            <p className="text-gray-700">{rentalDetails.message}</p>
          </div>
        )}

        {rentalDetails.pickupInstructions && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 font-medium">
              <User className="h-4 w-4" />
              Pickup instructions from {isOwner ? "you" : "owner"}:
            </h4>
            <p className="text-gray-700">{rentalDetails.pickupInstructions}</p>
          </div>
        )}

        {rentalDetails.returnInstructions && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h4 className="mb-2 flex items-center gap-2 font-medium">
              <User className="h-4 w-4" />
              Return instructions from {isOwner ? "you" : "owner"}:
            </h4>
            <p className="text-gray-700">{rentalDetails.returnInstructions}</p>
          </div>
        )}

        {!rentalDetails.message &&
          !rentalDetails.pickupInstructions &&
          !rentalDetails.returnInstructions && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-center text-gray-600">
                No messages or instructions for this rental.
              </p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
