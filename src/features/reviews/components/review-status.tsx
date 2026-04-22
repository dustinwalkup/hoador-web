"use client";

import { useState } from "react";
import { Clock, CheckCircle, Star } from "lucide-react";

function computeDaysLeft(reviewWindowEndAt: string | null): number | null {
  if (!reviewWindowEndAt) return null;
  const windowEnd = new Date(reviewWindowEndAt);
  return Math.max(
    0,
    Math.ceil((windowEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
}

interface ReviewStatusProps {
  hasReviewed: boolean;
  canReview: boolean;
  reviewWindowEndAt: string | null;
  onLeaveReview: () => void;
}

export function ReviewStatus({
  hasReviewed,
  canReview,
  reviewWindowEndAt,
  onLeaveReview,
}: ReviewStatusProps) {
  const [daysLeft] = useState(() => computeDaysLeft(reviewWindowEndAt));

  // User already submitted but review not released yet
  if (hasReviewed) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-100">
              Review submitted
            </p>
            <p className="mt-1 text-sm text-green-800 dark:text-green-200">
              Your review will be visible once both parties have submitted or
              the review window closes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // User can still leave a review
  if (canReview) {
    return (
      <div className="rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <Star className="text-primary mt-0.5 h-5 w-5" />
          <div className="flex-1">
            <p className="font-medium">Leave a Review</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Share your experience. Reviews are blind - neither party can see
              the other&apos;s review until both have submitted or the window
              closes.
            </p>
            {daysLeft !== null && (
              <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {daysLeft === 0
                    ? "Last day to review"
                    : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left to review`}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onLeaveReview}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              <Star className="mr-2 h-4 w-4" />
              Leave a Review
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Window expired and user hasn't reviewed — show nothing
  return null;
}
