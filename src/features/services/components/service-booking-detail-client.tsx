"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceBookingWithDetails } from "@/dal/service-booking.dal";
import type { ServiceReviewWithReviewer } from "@/dal/service-review.dal";
import {
  formatServiceUsd,
  serviceBookingStatusLabel,
} from "@/features/services/lib/service-labels";

type BookingPayload = Omit<
  ServiceBookingWithDetails,
  "proposedDate" | "completedAt" | "cancelledAt" | "createdAt" | "updatedAt"
> & {
  proposedDate: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

interface ServiceBookingDetailClientProps {
  booking: BookingPayload;
  isRequester: boolean;
  reviews: ServiceReviewWithReviewer[];
  myReview: ServiceReviewWithReviewer | null;
}

/**
 * Status actions, dialogs, and review form for a service booking detail view.
 */
export function ServiceBookingDetailClient({
  booking,
  isRequester,
  reviews,
  myReview,
}: ServiceBookingDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewBanner = searchParams.get("new") === "1";
  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [noShowNotes, setNoShowNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewPending, setReviewPending] = useState(false);

  const counterparty = isRequester ? booking.provider : booking.requester;
  const cpName =
    [counterparty.firstName, counterparty.lastName].filter(Boolean).join(" ") ||
    "User";

  async function refresh() {
    router.refresh();
  }

  async function postAccept() {
    setPending(true);
    try {
      const res = await fetch(`/api/services/bookings/${booking.id}/accept`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not accept");
        return;
      }
      toast.success("Booking accepted and payment processed.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function postDecline() {
    if (!declineReason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/services/bookings/${booking.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not decline");
        return;
      }
      setDeclineOpen(false);
      toast.success("Booking declined.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function postComplete() {
    setPending(true);
    try {
      const res = await fetch(`/api/services/bookings/${booking.id}/complete`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not complete");
        return;
      }
      setCompleteOpen(false);
      toast.success("Marked complete.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function postCancel() {
    setPending(true);
    try {
      const res = await fetch(`/api/services/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not cancel");
        return;
      }
      setCancelOpen(false);
      toast.success("Booking cancelled.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function postNoShow() {
    setPending(true);
    try {
      const res = await fetch(`/api/services/bookings/${booking.id}/no-show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: noShowNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not submit report");
        return;
      }
      setNoShowOpen(false);
      toast.success("Report submitted.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function postReview() {
    setReviewPending(true);
    try {
      const res = await fetch(`/api/services/bookings/${booking.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not submit review");
        return;
      }
      toast.success("Thanks for your review.");
      setComment("");
      await refresh();
    } finally {
      setReviewPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {showNewBanner ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100">
          Booking request sent. The provider will respond soon.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge>{serviceBookingStatusLabel(booking.status)}</Badge>
        <span className="text-muted-foreground text-sm">
          Total {formatServiceUsd(booking.totalAmount)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Avatar className="size-12">
          <AvatarImage src={counterparty.profileImageUrl ?? undefined} alt="" />
          <AvatarFallback>
            {(counterparty.firstName?.[0] ?? "") +
              (counterparty.lastName?.[0] ?? "")}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{cpName}</p>
          <p className="text-muted-foreground text-sm">
            {booking.listing.title}
          </p>
        </div>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Date</dt>
          <dd>
            {String(booking.proposedDate)} · {booking.proposedTime}
          </dd>
        </div>
        {booking.hours ? (
          <div>
            <dt className="text-muted-foreground">Hours</dt>
            <dd>{booking.hours}</dd>
          </div>
        ) : null}
        {booking.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-wrap">{booking.notes}</dd>
          </div>
        ) : null}
        {booking.status === "declined" && booking.declineReason ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Decline reason</dt>
            <dd>{booking.declineReason}</dd>
          </div>
        ) : null}
        {booking.status === "cancelled" ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Refund</dt>
            <dd>
              {booking.refundAmount
                ? formatServiceUsd(booking.refundAmount)
                : "—"}
            </dd>
          </div>
        ) : null}
      </dl>

      {booking.status === "payment_failed" && isRequester ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="mb-2 font-medium">
            Payment failed when the provider accepted.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/payments">Update payment method</Link>
          </Button>
        </div>
      ) : null}

      {booking.status === "payment_failed" && !isRequester ? (
        <p className="text-muted-foreground text-sm">
          Payment failed for this booking. The requester may need to update
          their card.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {booking.status === "pending" && isRequester ? (
          <Button variant="outline" onClick={() => setCancelOpen(true)}>
            Cancel request
          </Button>
        ) : null}
        {booking.status === "pending" && !isRequester ? (
          <>
            <Button onClick={postAccept} disabled={pending}>
              Accept
            </Button>
            <Button variant="outline" onClick={() => setDeclineOpen(true)}>
              Decline
            </Button>
          </>
        ) : null}

        {booking.status === "accepted" && isRequester ? (
          <>
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => setNoShowOpen(true)}>
              Report no-show
            </Button>
          </>
        ) : null}
        {booking.status === "accepted" && !isRequester ? (
          <>
            <Button onClick={() => setCompleteOpen(true)} disabled={pending}>
              Mark complete
            </Button>
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              Cancel
            </Button>
          </>
        ) : null}

        {booking.status === "completed" && !myReview ? (
          <div className="w-full space-y-2 rounded-md border p-4">
            <p className="font-medium">Leave a review</p>
            <div className="flex gap-2">
              <Label className="w-24">Rating</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="max-w-[6rem]"
              />
            </div>
            <Textarea
              placeholder="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <Button size="sm" disabled={reviewPending} onClick={postReview}>
              {reviewPending ? "Submitting…" : "Submit review"}
            </Button>
          </div>
        ) : null}

        {booking.status === "completed" && isRequester ? (
          <Button variant="outline" onClick={() => setNoShowOpen(true)}>
            Report no-show
          </Button>
        ) : null}
      </div>

      {reviews.length > 0 ? (
        <div>
          <h3 className="mb-2 font-semibold">Reviews</h3>
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm">
                <span className="font-medium">★ {r.rating}</span>
                {r.comment ? (
                  <p className="text-muted-foreground mt-1">{r.comment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline booking</DialogTitle>
          </DialogHeader>
          <Label htmlFor="dr">Reason (required)</Label>
          <Textarea
            id="dr"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>
              Close
            </Button>
            <Button onClick={postDecline} disabled={pending}>
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel booking</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Refunds depend on who cancels and how soon the service is scheduled.
            You may receive a full or partial refund if a charge was already
            made.
          </p>
          <Label htmlFor="cr">Reason (optional)</Label>
          <Textarea
            id="cr"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={2}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Close
            </Button>
            <Button onClick={postCancel} disabled={pending}>
              Confirm cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark job complete?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This starts the payout window (transfers run after the holding
            period).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Back
            </Button>
            <Button onClick={postComplete} disabled={pending}>
              Mark complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noShowOpen} onOpenChange={setNoShowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report no-show</DialogTitle>
          </DialogHeader>
          <Label htmlFor="ns">Notes (optional)</Label>
          <Textarea
            id="ns"
            value={noShowNotes}
            onChange={(e) => setNoShowNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoShowOpen(false)}>
              Close
            </Button>
            <Button onClick={postNoShow} disabled={pending}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
