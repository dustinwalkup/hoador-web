import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RentalDetails } from "@/dal/rentals.dal";

interface RentalReviewsCardProps {
  rentalDetails: Pick<RentalDetails, "id">;
  isRenter: boolean;
  isOwner: boolean;
}

export function RentalReviewsCard({}: RentalReviewsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Reviews
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h4 className="mb-3 font-medium">Leave a review for this rental</h4>
          <p className="text-gray-600">
            Reviews help the community and improve the platform for everyone.
          </p>
          {/* Review form would go here - simplified for now */}
        </div>
      </CardContent>
    </Card>
  );
}
