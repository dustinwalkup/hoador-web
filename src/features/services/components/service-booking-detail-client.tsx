"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MessageCircle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Headphones,
  ExternalLink,
  FileText,
  User,
  Loader2,
  Star,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ServiceFeeLine } from "@/components/payments/service-fee-line";
import { MessageUserAction } from "@/features/messages/components/message-user-action";
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
import { formatLocalDate } from "@/lib/utils/date.utils";
import { FileDisputeDialog } from "@/features/disputes/components/file-dispute-dialog";
import { TimeWindowValidation } from "@/features/disputes/lib/time-window-validation";
import { ServiceStatusProgress } from "@/features/services/components/detail-page/service-status-progress";
import { BookingReviewsSection } from "@/features/reviews/components/booking-reviews-section";
import { ReviewFormDialog } from "@/features/reviews/components/review-form-dialog";
import { PayoutSetupRequiredDialog } from "@/features/payments/components/payout-setup-required-dialog";
import type { OnboardingStatus } from "@/features/payments/lib/payout-readiness";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UserInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ListingInfo {
  id: string;
  title: string;
  pricingType: "hourly" | "fixed";
  price: number;
  category?: string | null;
}

export interface ServiceBookingPayload {
  id: string;
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "completed"
    | "cancelled"
    | "payment_failed"
    | "no_show";
  proposedDate: string;
  proposedTime: string;
  hours: number | null;
  notes: string | null;
  totalAmount: number;
  serviceFee: number;
  refundAmount: number | null;
  declineReason: string | null;
  cancelReason: string | null;
  listing: ListingInfo;
  provider: UserInfo;
  requester: UserInfo;
  providerId: string;
  requesterId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  /** Conversation between requester and provider, if any. */
  conversationId: string | null;
}

interface ServiceBookingDetailClientProps {
  booking: ServiceBookingPayload;
  isRequester: boolean;
  /** Current published Cancellation & Refund policy URL (e.g. PDF), when configured. */
  cancellationPolicyUrl?: string;
  /** Dispute policy URL for filing a dispute. */
  disputePolicyUrl?: string;
  /** Generated service agreement PDF URL, if available. */
  serviceAgreementUrl?: string;
  /** True when an open dispute already exists for this booking. */
  hasActiveDispute?: boolean;
  /**
   * Set to true only if numeric props are in cents. Server-serialized bookings
   * use dollar amounts from the DB (numeric scale 2); default is false.
   */
  priceInCents?: boolean;
  /** Whether the current user can leave a review for this booking. */
  canReview?: boolean;
  /**
   * The provider's Stripe Connect payout readiness. Only meaningful when the
   * current viewer IS the provider; used to pre-check the Accept action and
   * surface a JIT onboarding dialog when not verified.
   */
  providerOnboardingStatus?: OnboardingStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side form validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const declineFormSchema = z.object({
  reason: z
    .string()
    .min(1, "Reason is required")
    .max(2000, "Reason must be 2,000 characters or less"),
});

const cancelFormSchema = z.object({
  reason: z
    .string()
    .min(1, "Reason is required")
    .max(1000, "Reason must be 1,000 characters or less"),
});

// ──────���──────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ServiceBookingPayload["status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pending", variant: "secondary" },
  accepted: { label: "Accepted", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "outline" },
  payment_failed: { label: "Payment Failed", variant: "destructive" },
  no_show: { label: "No Show", variant: "destructive" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function ServiceBookingDetailClient({
  booking,
  isRequester,
  cancellationPolicyUrl,
  disputePolicyUrl,
  serviceAgreementUrl,
  hasActiveDispute = false,
  priceInCents = false,
  canReview: canReviewProp = false,
  providerOnboardingStatus,
}: ServiceBookingDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showNewBanner = searchParams.get("new") === "1";

  // Dialog states
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [payoutSetupOpen, setPayoutSetupOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [canReview, setCanReview] = useState(canReviewProp);

  // Form states
  const [declineReason, setDeclineReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [pending, setPending] = useState(false);

  // Field validation errors
  const [declineReasonError, setDeclineReasonError] = useState<string | null>(
    null,
  );
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(
    null,
  );

  // Price conversion
  const toUsd = (amount: number) =>
    formatUsd(priceInCents ? amount / 100 : amount);

  // Counterparty info
  const counterparty = isRequester ? booking.provider : booking.requester;
  const cpName =
    [counterparty.firstName, counterparty.lastName].filter(Boolean).join(" ") ||
    "User";
  const cpInitials =
    (counterparty.firstName?.[0] ?? "") + (counterparty.lastName?.[0] ?? "");
  const roleLabel = isRequester ? "Provider" : "Client";

  // Status config
  const statusConfig = STATUS_CONFIG[booking.status];

  // Format date
  const formattedDate = useMemo(() => {
    try {
      return formatLocalDate(booking.proposedDate);
    } catch {
      return booking.proposedDate;
    }
  }, [booking.proposedDate]);

  // Format time
  const formattedTime = useMemo(() => {
    try {
      const [h, m] = booking.proposedTime.split(":");
      const date = new Date();
      date.setHours(parseInt(h), parseInt(m));
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return booking.proposedTime;
    }
  }, [booking.proposedTime]);

  const canFileServiceDispute = useMemo(() => {
    if (hasActiveDispute) {
      return false;
    }
    if (booking.status !== "accepted" && booking.status !== "completed") {
      return false;
    }
    const completedAtDate = booking.completedAt
      ? new Date(booking.completedAt)
      : null;
    return TimeWindowValidation.validateServiceFilingWindow(
      booking.proposedDate,
      booking.proposedTime,
      completedAtDate,
    ).valid;
  }, [
    hasActiveDispute,
    booking.status,
    booking.proposedDate,
    booking.proposedTime,
    booking.completedAt,
  ]);

  // API handlers
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
        const body = data as { error?: string; paymentFailed?: boolean };
        // Server gated the accept because the provider's Stripe Connect isn't
        // ready. Send them into the JIT onboarding flow, preserving where they
        // came from so we can return them here on completion. No toast — the
        // navigation is the user feedback.
        if (res.status === 403 && body.error === "PAYMENT_SETUP_REQUIRED") {
          const returnTo = encodeURIComponent(
            window.location.pathname + window.location.search,
          );
          router.push(
            `/dashboard/payments/earnings-and-payouts?returnTo=${returnTo}`,
          );
          return;
        }
        toast.error(
          body.paymentFailed
            ? "The payment method failed. The requester has been notified to update their payment method."
            : (body.error ?? "Could not accept"),
        );
        return;
      }
      toast.success("Booking accepted and payment processed.");
      setAcceptOpen(false);
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function postDecline() {
    const result = declineFormSchema.safeParse({ reason: declineReason });
    if (!result.success) {
      setDeclineReasonError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setDeclineReasonError(null);
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
    const result = cancelFormSchema.safeParse({ reason: cancelReason });
    if (!result.success) {
      setCancelReasonError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setCancelReasonError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/services/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not cancel");
        return;
      }
      setCancelOpen(false);
      setCancelReason("");
      toast.success("Booking cancelled.");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground font-inherit inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-sm shadow-none transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </div>

      {/* New booking banner */}
      {showNewBanner && (
        <div className="border-primary bg-primary/5 text-foreground rounded-lg border px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-primary h-4 w-4" />
            <span className="text-primary">
              Booking request sent. The provider will respond soon.
            </span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - Main info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Booking Status
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {statusConfig.label}
              </p>
            </CardHeader>
            <CardContent>
              <ServiceStatusProgress
                currentStatus={booking.status}
                userRole={isRequester ? "client" : "provider"}
                scheduledDate={
                  new Date(`${booking.proposedDate}T${booking.proposedTime}`)
                }
                completedAt={
                  booking.completedAt ? new Date(booking.completedAt) : null
                }
              />

              {booking.status === "declined" && booking.declineReason && (
                <div className="border-destructive/20 bg-destructive/5 mt-4 rounded-lg border p-3">
                  <p className="text-destructive text-sm font-medium">
                    Decline reason
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {booking.declineReason}
                  </p>
                </div>
              )}

              {booking.status === "cancelled" && booking.refundAmount && (
                <div className="bg-muted/30 mt-4 rounded-lg border p-3">
                  <p className="text-sm font-medium">Refund issued</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {toUsd(booking.refundAmount)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-muted-foreground h-4 w-4" />
                <CardTitle className="text-lg font-semibold">
                  Service Details
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Service info */}
              <div>
                <h3 className="text-foreground font-medium">
                  {booking.listing.title}
                </h3>
                {booking.listing.category && (
                  <Badge variant="secondary" className="mt-1">
                    {booking.listing.category}
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Schedule */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Calendar className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Date</p>
                    <p className="text-sm font-medium">{formattedDate}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Time</p>
                    <p className="text-sm font-medium">{formattedTime}</p>
                  </div>
                </div>
              </div>

              {booking.hours && (
                <div className="flex items-start gap-3">
                  <Clock className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Duration</p>
                    <p className="text-sm font-medium">
                      {booking.hours} hour{booking.hours !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Pricing breakdown */}
              <div>
                <h4 className="mb-3 text-sm font-medium">Pricing Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {booking.listing.pricingType === "hourly" && booking.hours
                        ? `${toUsd(booking.listing.price)}/hr × ${booking.hours} hrs`
                        : "Service"}
                    </span>
                    <span>
                      {toUsd(booking.totalAmount - booking.serviceFee)}
                    </span>
                  </div>
                  <ServiceFeeLine
                    amount={booking.serviceFee}
                    className="text-sm"
                  />
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span className="text-primary">
                      {toUsd(booking.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          {booking.notes && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="text-muted-foreground h-4 w-4" />
                  <CardTitle className="text-lg font-semibold">
                    Notes from {isRequester ? "you" : "client"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {booking.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Payment Failed Alert */}
          {booking.status === "payment_failed" && isRequester && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Payment failed when the provider accepted
                  </p>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                    Please update your payment method to proceed with this
                    booking.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link href="/dashboard/payments">
                      Update payment method
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Reviews Section — blind review system */}
          <BookingReviewsSection
            key={`reviews-${canReview}`}
            serviceBookingId={booking.id}
            bookingStatus={booking.status}
          />
        </div>

        {/* Right column - Sidebar */}
        <div className="space-y-6">
          {/* Counterparty Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="text-muted-foreground h-4 w-4" />
                <CardTitle className="text-base font-semibold">
                  {roleLabel}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage
                    src={counterparty.profileImageUrl ?? undefined}
                    alt={cpName}
                  />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    {cpInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{cpName}</p>
                  <p className="text-muted-foreground text-xs">View profile</p>
                </div>
              </div>

              <MessageUserAction
                recipientId={counterparty.id}
                recipientName={cpName}
                serviceListingId={booking.listing.id}
                listingName={booking.listing.title}
                existingConversationId={booking.conversationId}
                buttonText={isRequester ? "Message Provider" : "Message Client"}
              />
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Pending - Requester */}
              {booking.status === "pending" && isRequester && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Request
                </Button>
              )}

              {/* Pending or payment failed - Provider */}
              {(booking.status === "pending" ||
                booking.status === "payment_failed") &&
                !isRequester && (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (
                          providerOnboardingStatus &&
                          providerOnboardingStatus !== "verified"
                        ) {
                          setPayoutSetupOpen(true);
                        } else {
                          setAcceptOpen(true);
                        }
                      }}
                      disabled={pending}
                    >
                      {pending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Accept Booking
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => setDeclineOpen(true)}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Decline Booking
                    </Button>
                  </>
                )}

              {/* Accepted - Requester */}
              {booking.status === "accepted" && isRequester && (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Booking
                  </Button>
                  {canFileServiceDispute && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setDisputeOpen(true)}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      File a Dispute
                    </Button>
                  )}
                </>
              )}

              {/* Accepted - Provider */}
              {booking.status === "accepted" && !isRequester && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => setCompleteOpen(true)}
                    disabled={pending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark Complete
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setCancelOpen(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Booking
                  </Button>
                  {canFileServiceDispute && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setDisputeOpen(true)}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      File a Dispute
                    </Button>
                  )}
                </>
              )}

              {/* Completed — leave a review (both parties) */}
              {canReview && (
                <Button className="w-full" onClick={() => setReviewOpen(true)}>
                  <Star className="mr-2 h-4 w-4" />
                  Leave a Review
                </Button>
              )}

              {/* Completed — dispute window (both parties) */}
              {booking.status === "completed" && canFileServiceDispute && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setDisputeOpen(true)}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  File a Dispute
                </Button>
              )}

              {/* Service Agreement */}
              {serviceAgreementUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      serviceAgreementUrl,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Service Agreement
                </Button>
              )}

              {/* View listing */}
              <Button variant="outline" className="w-full" asChild>
                <Link
                  href={`/dashboard/services/listings/${booking.listing.id}`}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Listing
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Trust Indicators */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-3">
                <Shield className="text-primary mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">Protected Transaction</p>
                  <p className="text-muted-foreground text-xs">
                    Payment held securely until completion
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-primary mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">Verified Provider</p>
                  <p className="text-muted-foreground text-xs">
                    Identity and background verified
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Headphones className="text-primary mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">24/7 Support</p>
                  <p className="text-muted-foreground text-xs">
                    Help available anytime
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Accept Booking
            </DialogTitle>
            <DialogDescription>
              Accepting this booking will charge the requester&apos;s payment
              method. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAcceptOpen(false)}
              disabled={pending}
            >
              Back
            </Button>
            <Button type="button" onClick={postAccept} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accept Booking
                </>
              ) : (
                "Accept Booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {providerOnboardingStatus && providerOnboardingStatus !== "verified" && (
        <PayoutSetupRequiredDialog
          open={payoutSetupOpen}
          onOpenChange={setPayoutSetupOpen}
          onboardingStatus={providerOnboardingStatus}
        />
      )}

      <Dialog
        open={declineOpen}
        onOpenChange={(open) => {
          setDeclineOpen(open);
          if (!open) {
            setDeclineReason("");
            setDeclineReasonError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Booking</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining this booking request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Reason (required)</Label>
            <Textarea
              id="decline-reason"
              placeholder="e.g., I'm not available at this time..."
              value={declineReason}
              aria-invalid={!!declineReasonError}
              onChange={(e) => {
                setDeclineReason(e.target.value);
                if (declineReasonError) setDeclineReasonError(null);
              }}
              rows={3}
            />
            {declineReasonError && (
              <p className="text-destructive text-[0.8rem] font-medium">
                {declineReasonError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>
              Cancel
            </Button>
            <Button onClick={postDecline} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) {
            setCancelReason("");
            setCancelReasonError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Refunds depend on who cancels and how soon the service is
              scheduled. You may receive a full or partial refund if a charge
              was already made.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason (required)</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Let us know why you're cancelling..."
              value={cancelReason}
              aria-invalid={!!cancelReasonError}
              onChange={(e) => {
                setCancelReason(e.target.value);
                if (cancelReasonError) setCancelReasonError(null);
              }}
              rows={2}
            />
            {cancelReasonError && (
              <p className="text-destructive text-[0.8rem] font-medium">
                {cancelReasonError}
              </p>
            )}
          </div>
          <DialogFooter>
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
              {cancellationPolicyUrl ? (
                <Link
                  href={cancellationPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex shrink-0 items-center gap-1 text-sm hover:underline"
                >
                  Read cancellation policy
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
              <div className="ml-auto flex shrink-0 gap-2">
                <Button variant="outline" onClick={() => setCancelOpen(false)}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={postCancel}
                  disabled={pending}
                >
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Cancel
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Job Complete?</DialogTitle>
            <DialogDescription>
              This starts the payout window. Transfers will run after the
              holding period ends.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Back
            </Button>
            <Button onClick={postComplete} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FileDisputeDialog
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        serviceBookingId={booking.id}
        serviceFilerRole={isRequester ? "requester" : "provider"}
        listingName={booking.listing.title}
        disputePolicyUrl={disputePolicyUrl}
      />

      <ReviewFormDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        serviceBookingId={booking.id}
        onSuccess={() => {
          setCanReview(false);
          router.refresh();
        }}
      />
    </div>
  );
}
