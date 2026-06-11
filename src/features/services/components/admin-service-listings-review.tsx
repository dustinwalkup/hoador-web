"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { ServiceListingReviewWithCategoryAndProvider } from "@/dal/service-listing.dal";
import { formatServiceUsd } from "@/features/services/lib/service-labels";
import {
  OwnerInformation,
  type AdminOwnerInformationRating,
} from "@/features/admin/components/listing-review/owner-information";
import { ServiceListingApproveRejectDialog } from "@/features/admin/components/listing-review/service-listing-approve-reject-dialog";
import { sanitizeForDisplay } from "@/lib/utils/sanitize-client";
import { formatDateTimeLocal } from "@/lib/utils/date.utils";
import { formatActorName } from "@/lib/utils";

interface AdminServiceListingsReviewProps {
  listings: ServiceListingReviewWithCategoryAndProvider[];
}

interface PendingServiceListingRowProps {
  listing: ServiceListingReviewWithCategoryAndProvider;
  onMutationSuccess: () => void;
}

/**
 * Single pending service listing row with approve/reject dialogs (matches rental review card pattern).
 */
function PendingServiceListingRow({
  listing,
  onMutationSuccess,
}: PendingServiceListingRowProps) {
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const submitted = formatDateTimeLocal(listing.createdAt);

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="font-medium">{listing.title}</p>
            <p className="text-muted-foreground text-sm">
              {listing.category.name} ·{" "}
              {listing.pricingType === "hourly"
                ? `${formatServiceUsd(listing.price)}/hr`
                : formatServiceUsd(listing.price)}{" "}
              · Submitted {submitted}
            </p>
          </div>

          <div className="flex shrink-0 gap-2 self-start">
            <Button
              size="sm"
              variant="default"
              onClick={() => setApproveDialogOpen(true)}
              className="bg-primary hover:bg-green-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => setRejectDialogOpen(true)}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Request Revisions
            </Button>
          </div>
        </div>

        {/* About + notes (admin review context) */}
        <section className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            About this service
          </h2>
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
            {sanitizeForDisplay(listing.description)}
          </p>

          {listing.serviceNotes && (
            <>
              <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                Service notes
              </h2>
              <div className="bg-muted/30 rounded-lg border p-4">
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {sanitizeForDisplay(listing.serviceNotes)}
                </p>
              </div>
            </>
          )}
        </section>

        <Separator />

        {listing.reviewEvents && listing.reviewEvents.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              Review history
            </h2>
            <div className="space-y-2">
              {listing.reviewEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {event.eventType === "provider_resubmitted"
                            ? "Resubmitted"
                            : event.eventType}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {formatDateTimeLocal(event.createdAt)}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        By {formatActorName(event.actor)}
                      </div>
                    </div>
                  </div>

                  {event.note && event.note.trim().length > 0 && (
                    <div className="mt-2 text-sm whitespace-pre-wrap">
                      <span className="font-medium">Note:</span>{" "}
                      <span>{sanitizeForDisplay(event.note)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="w-full">
          <OwnerInformation
            owner={{
              firstName: listing.provider.firstName,
              lastName: listing.provider.lastName,
              profileImageUrl: listing.provider.profileImageUrl,
              isVerified: listing.provider.isVerified,
              email: listing.provider.email,
              createdAt: listing.provider.createdAt,
              otherListingsCount: listing.provider.otherListingsCount,
            }}
            rating={
              {
                averageRating: listing.provider.averageRating,
                totalCount: listing.provider.totalReviews,
                totalCountNoun: "review",
              } satisfies AdminOwnerInformationRating
            }
          />
        </div>
      </div>

      <ServiceListingApproveRejectDialog
        listingId={listing.id}
        listingName={listing.title}
        action="approve"
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        onMutationSuccess={onMutationSuccess}
      />
      <ServiceListingApproveRejectDialog
        listingId={listing.id}
        listingName={listing.title}
        action="reject"
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onMutationSuccess={onMutationSuccess}
      />
    </>
  );
}

/**
 * Approve / reject pending HOA service listings (admin).
 */
export function AdminServiceListingsReview({
  listings,
}: AdminServiceListingsReviewProps) {
  const router = useRouter();

  if (listings.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
        No listings pending review
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {listings.map((listing) => (
        <PendingServiceListingRow
          key={listing.id}
          listing={listing}
          // `listings` arrives as RSC props from the admin review page (no
          // query cache entry), so router.refresh re-renders the list after a
          // review action. Intentional — do not swap for invalidateQueries.
          onMutationSuccess={() => router.refresh()}
        />
      ))}
    </div>
  );
}
