"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReviewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId?: string;
  serviceBookingId?: string;
  onSuccess: () => void;
}

function StarRatingInput({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (r: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="cursor-pointer transition-transform hover:scale-110"
        >
          <Star
            className={`h-6 w-6 ${
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40 fill-none"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewFormDialog({
  open,
  onOpenChange,
  rentalId,
  serviceBookingId,
  onSuccess,
}: ReviewFormDialogProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  async function handleSubmit() {
    if (rating < 1 || rating > 5) return;
    if (comment.length > 2000) {
      setCommentError("Comment must be 2,000 characters or less");
      return;
    }
    setCommentError(null);
    setPending(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(rentalId ? { rentalId } : { serviceBookingId }),
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          toast.error("You have already submitted a review for this booking.");
        } else {
          toast.error(
            (data as { error?: string }).error || "Could not submit review",
          );
        }
        return;
      }

      toast.success(
        "Review submitted! It will be visible once both parties have reviewed or the window closes.",
      );
      setRating(5);
      setComment("");
      onOpenChange(false);
      onSuccess();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) {
          onOpenChange(v);
          if (!v) {
            setRating(5);
            setComment("");
            setCommentError(null);
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Leave a Review</DialogTitle>
          <DialogDescription>
            Your review is blind - it won&apos;t be visible until both parties
            have submitted or the review window closes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-muted-foreground mb-2 block text-sm">
              Rating
            </Label>
            <StarRatingInput rating={rating} onChange={setRating} />
          </div>
          <div>
            <Label
              htmlFor="review-comment"
              className="text-muted-foreground mb-2 block text-sm"
            >
              Comment (optional)
            </Label>
            <Textarea
              id="review-comment"
              placeholder="Share your experience..."
              value={comment}
              aria-invalid={!!commentError}
              onChange={(e) => {
                setComment(e.target.value);
                if (commentError) setCommentError(null);
              }}
              rows={4}
              maxLength={2000}
            />
            <div className="mt-1 flex items-center justify-between">
              {commentError ? (
                <p className="text-destructive text-[0.8rem] font-medium">
                  {commentError}
                </p>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground text-xs">
                {comment.length}/2000
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
