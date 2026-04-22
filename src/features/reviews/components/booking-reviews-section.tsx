"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { ReviewStatus } from "./review-status";
import { ReviewFormDialog } from "./review-form-dialog";
import { ReviewCard } from "./review-card";

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  releasedAt: string;
  reviewerRole?: string;
  reviewer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

interface ReviewStatusData {
  hasReviewed: boolean;
  canReview: boolean;
  reviewWindowEndAt: string | null;
}

interface BookingReviewsSectionProps {
  rentalId?: string;
  serviceBookingId?: string;
  bookingStatus: string;
}

export function BookingReviewsSection({
  rentalId,
  serviceBookingId,
  bookingStatus,
}: BookingReviewsSectionProps) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusData | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    try {
      const param = rentalId
        ? `rentalId=${rentalId}`
        : `serviceBookingId=${serviceBookingId}`;
      const res = await fetch(`/api/reviews?${param}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        reviews: ReviewData[];
        reviewStatus: ReviewStatusData;
      };
      setReviews(data.reviews);
      setReviewStatus(data.reviewStatus);
    } finally {
      setLoading(false);
    }
  }, [rentalId, serviceBookingId]);

  useEffect(() => {
    if (bookingStatus === "completed") {
      fetchReviews();
    } else {
      setLoading(false);
    }
  }, [bookingStatus, fetchReviews]);

  // Only show for completed bookings
  if (bookingStatus !== "completed") return null;
  if (loading) return null;

  const hasContent =
    reviews.length > 0 || reviewStatus?.canReview || reviewStatus?.hasReviewed;

  if (!hasContent) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Star className="text-muted-foreground h-4 w-4" />
            <CardTitle className="text-lg font-semibold">Reviews</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Review status / CTA — hide once reviews are released */}
          {reviewStatus && reviews.length === 0 && (
            <ReviewStatus
              hasReviewed={reviewStatus.hasReviewed}
              canReview={reviewStatus.canReview}
              reviewWindowEndAt={reviewStatus.reviewWindowEndAt}
              onLeaveReview={() => setFormOpen(true)}
            />
          )}

          {/* Released reviews */}
          {reviews.length > 0 && (
            <div className="space-y-3">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ReviewFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        rentalId={rentalId}
        serviceBookingId={serviceBookingId}
        onSuccess={fetchReviews}
      />
    </>
  );
}
