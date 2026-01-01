"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Star, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createReview } from "../actions/create-review";

interface LeaveReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string; // This can be either rentals.id or rental_requests.id
  listingName: string;
  onSuccess?: () => void;
  isRequestId?: boolean; // If true, rentalId is a requestId, otherwise it's a rentalId
  reviewPolicyUrl?: string;
}

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
            aria-label={`Rate ${star} out of 5`}
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                star <= value
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-gray-200 text-gray-200 hover:fill-gray-300 hover:text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function LeaveReviewModal({
  open,
  onOpenChange,
  rentalId,
  listingName,
  onSuccess,
  isRequestId = true, // Default to true since we're usually passing requestId
  reviewPolicyUrl,
}: LeaveReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [accuracyRating, setAccuracyRating] = useState<number | undefined>(
    undefined,
  );
  const [listingConditionRating, setListingConditionRating] = useState<
    number | undefined
  >(undefined);
  const [ownerCommunicationRating, setOwnerCommunicationRating] = useState<
    number | undefined
  >(undefined);

  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (!comment.trim() || comment.trim().length < 10) {
      toast.error("Please write a comment (at least 10 characters)");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createReview({
          ...(isRequestId ? { requestId: rentalId } : { rentalId }),
          rating,
          comment,
          accuracyRating,
          listingConditionRating,
          ownerCommunicationRating,
        });

        if (result.success) {
          toast.success("Review submitted successfully!", {
            description: "Thank you for your feedback.",
          });
          onOpenChange(false);
          onSuccess?.();
          // Reset form
          setRating(0);
          setComment("");
          setAccuracyRating(undefined);
          setListingConditionRating(undefined);
          setOwnerCommunicationRating(undefined);
        } else {
          console.log("ELSE", result);
          toast.error("Failed to submit review", {
            description: result.error || "Please try again.",
          });
        }
      } catch {
        console.error("Error in handleSubmit:");
        toast.error("Failed to submit review", {
          description: "An unexpected error occurred. Please try again.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Leave a Review
          </DialogTitle>
          <DialogDescription>
            Share your experience with {listingName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Overall Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Overall Rating <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                  aria-label={`Rate ${star} out of 5`}
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-gray-200 text-gray-200 hover:fill-gray-300 hover:text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-medium">
              Your Review <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="comment"
              name="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this rental..."
              className="min-h-[100px]"
              required
              minLength={10}
              maxLength={2000}
            />
            <p className="text-xs text-gray-500">
              {comment.length}/2000 characters
            </p>
          </div>

          {/* Optional Structured Ratings */}
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium text-gray-700">
              Optional Detailed Ratings
            </p>

            <StarRating
              value={accuracyRating || 0}
              onChange={(value) => setAccuracyRating(value)}
              label="Accuracy of Listing"
            />

            <StarRating
              value={listingConditionRating || 0}
              onChange={(value) => setListingConditionRating(value)}
              label="Tool Condition"
            />

            <StarRating
              value={ownerCommunicationRating || 0}
              onChange={(value) => setOwnerCommunicationRating(value)}
              label="Owner Communication"
            />
          </div>

          <DialogFooter>
            <div className="flex w-full flex-col gap-2">
              <div className="flex justify-between gap-2">
                {reviewPolicyUrl && (
                  <Link
                    href={reviewPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    Read review policy
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending || rating === 0}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Review"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
