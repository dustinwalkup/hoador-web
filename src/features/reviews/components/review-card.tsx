"use client";

import { Star } from "lucide-react";
import { ReviewerAvatar } from "./reviewer-avatar";
import { formatDistanceToNow } from "@/lib/utils/date.utils";

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    comment: string | null;
    submittedAt: string | Date;
    releasedAt: string | Date;
    reviewerRole?: string;
    reviewer: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  };
}

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ReviewerAvatar
            avatarUrl={review.reviewer.avatarUrl}
            name={review.reviewer.name}
            reviewerId={review.reviewer.id}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{review.reviewer.name}</span>
              {review.reviewerRole && (
                <span className="text-muted-foreground text-xs">
                  ({review.reviewerRole})
                </span>
              )}
            </div>
            <div className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(review.submittedAt), {
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
      {review.comment && <p className="text-sm">{review.comment}</p>}
    </div>
  );
}
