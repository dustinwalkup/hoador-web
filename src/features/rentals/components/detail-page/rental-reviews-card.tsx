"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RentalDetails } from "@/dal/rentals.dal";
import { LeaveReviewModal } from "@/features/reviews/components/leave-review-modal";
import { formatDistanceToNow } from "date-fns";

interface RentalReviewsCardProps {
  rentalDetails: Pick<
    RentalDetails,
    "id" | "listingName" | "hasReview" | "canLeaveReview" | "status" | "review"
  >;
  isRenter: boolean;
  isOwner: boolean;
}

export function RentalReviewsCard({
  rentalDetails,
  isRenter,
}: RentalReviewsCardProps) {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const router = useRouter();
  const review = rentalDetails.review || null;

  if (rentalDetails.status !== "completed") {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Reviews
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {review ? (
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={review.reviewer?.profileImageUrl || undefined}
                    />
                    <AvatarFallback>
                      {review.reviewer
                        ? `${review.reviewer.firstName[0]}${review.reviewer.lastName[0]}`
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {review.reviewer
                        ? `${review.reviewer.firstName} ${review.reviewer.lastName}`
                        : "Anonymous"}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(review.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= review.rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-amber-200 text-amber-200"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {review.comment && (
                <p className="text-sm text-gray-700">{review.comment}</p>
              )}

              {/* Structured Ratings */}
              {(review.accuracyRating ||
                review.listingConditionRating ||
                review.ownerCommunicationRating) && (
                <div className="mt-4 space-y-2 border-t pt-4">
                  {review.accuracyRating && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Accuracy of Listing</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= review.accuracyRating!
                                ? "fill-amber-400 text-amber-400"
                                : "fill-amber-200 text-amber-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.listingConditionRating && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Tool Condition</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= review.listingConditionRating!
                                ? "fill-amber-400 text-amber-400"
                                : "fill-amber-200 text-amber-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {review.ownerCommunicationRating && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Owner Communication</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= review.ownerCommunicationRating!
                                ? "fill-amber-400 text-amber-400"
                                : "fill-amber-200 text-amber-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : rentalDetails.canLeaveReview && isRenter ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <h4 className="mb-3 font-medium">Leave a review for this rental</h4>
            <p className="mb-4 text-gray-600">
              Reviews help the community and improve the platform for everyone.
            </p>
            <Button onClick={() => setShowReviewModal(true)}>
              <Star className="mr-2 h-4 w-4" />
              Leave Review
            </Button>
          </div>
        ) : (
          <div className="text-muted-foreground py-4 text-center">
            No review yet
          </div>
        )}
      </CardContent>

      <LeaveReviewModal
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        rentalId={rentalDetails.id}
        listingName={rentalDetails.listingName}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </Card>
  );
}
