/**
 * Dashboard activity feed: composite of recent rental activity, reviews, listing updates,
 * and services (bookings, service reviews, service listings).
 * @see specs/dashboard/2-design.md getDashboardActivityFeed
 */

import {
  listingDAL,
  rentalDAL,
  reviewDAL,
  serviceBookingDAL,
  serviceListingDAL,
  serviceReviewDAL,
} from "@/dal";
import { formatDistanceToNow } from "@/lib/utils/date.utils";
import type { ActivityFeedItem } from "@/features/dashboard/types";

/** Internal item before mapping to ActivityFeedItem. */
type RawFeedItem = {
  id: string;
  timestamp: Date;
  title: string;
  description?: string;
  linkTo?: string;
};

/**
 * Returns a composite activity feed: recent rental requests (as renter/owner),
 * completed rentals, new/updated listings, reviews received, and parallel service
 * activity (bookings, service reviews, service listing updates). Sorted by date desc.
 *
 * @param userId - Current user id
 * @param limit - Max items (e.g. 10)
 * @returns ActivityFeedItem[] with title, description, timestamp, relativeTime, linkTo
 */
export async function getDashboardActivityFeed(
  userId: string,
  limit: number,
): Promise<ActivityFeedItem[]> {
  const fetchLimit = Math.max(limit * 2, 20);

  const [
    rentalActivity,
    reviewsReceived,
    userListings,
    serviceBookingsAsRequester,
    serviceBookingsAsProvider,
    serviceReviewsReceived,
    serviceListingsOwned,
  ] = await Promise.all([
    rentalDAL.getRecentRentalActivity(userId, fetchLimit),
    reviewDAL.getRecentReviews(userId, { limit: fetchLimit }),
    listingDAL.getUserListings(userId),
    serviceBookingDAL.findByRequesterForDashboard(userId),
    serviceBookingDAL.findByProviderForDashboard(userId),
    serviceReviewDAL.findByReviewee(userId, { limit: fetchLimit }),
    serviceListingDAL.findByProvider(userId),
  ]);

  const raw: RawFeedItem[] = [];

  for (const r of rentalActivity) {
    const title = formatRentalActivityTitle(r.status, r.role);
    const description = `${r.listingName}`;
    raw.push({
      id: `rental-${r.id}`,
      timestamp: r.updatedAt,
      title,
      description,
      linkTo: r.linkTo,
    });
  }

  for (const rev of reviewsReceived) {
    const reviewerName = rev.reviewer?.name ?? "Someone";
    const listingName = rev.listing?.name ?? "your listing";
    raw.push({
      id: `review-${rev.id}`,
      timestamp: rev.createdAt,
      title: "New review received",
      description: `${reviewerName} left you a ${rev.rating}-star review on ${listingName}`,
      linkTo: rev.listing?.id
        ? `/dashboard/listings/${rev.listing.id}`
        : undefined,
    });
  }

  const sortedListings = [...userListings].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  for (const listing of sortedListings.slice(0, limit)) {
    raw.push({
      id: `listing-${listing.id}`,
      timestamp: new Date(listing.updatedAt),
      title: "Listing updated",
      description: listing.name,
      linkTo: `/dashboard/listings/${listing.id}/edit`,
    });
  }

  const requesterSlice = serviceBookingsAsRequester.slice(0, fetchLimit);
  for (const row of requesterSlice) {
    const title = formatServiceBookingTitle(row.status, "requester");
    raw.push({
      id: `service-booking-${row.id}`,
      timestamp: row.updatedAt,
      title,
      description: row.listingTitle,
      linkTo: `/dashboard/services/bookings/${row.id}`,
    });
  }

  const providerSlice = serviceBookingsAsProvider.slice(0, fetchLimit);
  for (const row of providerSlice) {
    const title = formatServiceBookingTitle(row.status, "provider");
    raw.push({
      id: `service-booking-${row.id}`,
      timestamp: row.updatedAt,
      title,
      description: row.listingTitle,
      linkTo: `/dashboard/services/bookings/${row.id}`,
    });
  }

  for (const rev of serviceReviewsReceived) {
    const reviewerName = formatServiceReviewerName(rev.reviewer);
    raw.push({
      id: `service-review-${rev.id}`,
      timestamp: rev.createdAt,
      title: "New service review received",
      description: `${reviewerName} left you a ${rev.rating}-star review on your service`,
      linkTo: `/dashboard/services/listings/${rev.listingId}`,
    });
  }

  const sortedServiceListings = [...serviceListingsOwned].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  for (const listing of sortedServiceListings.slice(0, limit)) {
    raw.push({
      id: `service-listing-${listing.id}`,
      timestamp: new Date(listing.updatedAt),
      title: "Service listing updated",
      description: listing.title,
      linkTo: `/dashboard/services/listings/${listing.id}/edit`,
    });
  }

  raw.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const top = raw.slice(0, limit);

  return top.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    timestamp: item.timestamp,
    relativeTime: formatDistanceToNow(item.timestamp, { addSuffix: true }),
    linkTo: item.linkTo,
  }));
}

function formatRentalActivityTitle(
  status: string,
  role: "renter" | "owner",
): string {
  const asRenter: Record<string, string> = {
    pending: "Rental request sent",
    approved: "Rental request approved",
    active: "Rental started",
    completed: "Rental completed",
    denied: "Rental request denied",
    cancelled: "Rental request cancelled",
  };
  const asOwner: Record<string, string> = {
    pending: "New rental request",
    approved: "Request approved",
    active: "Rental started",
    completed: "Rental completed",
    denied: "Request declined",
    cancelled: "Request cancelled",
  };
  const map = role === "renter" ? asRenter : asOwner;
  return map[status] ?? "Rental activity";
}

/**
 * Human-readable title for a service booking row based on status and perspective.
 *
 * @param status - Booking status from `service_booking_status`
 * @param role - Whether the current user is the requester or the provider
 */
function formatServiceBookingTitle(
  status: string,
  role: "requester" | "provider",
): string {
  const asRequester: Record<string, string> = {
    pending: "Service booking requested",
    accepted: "Service booking accepted",
    declined: "Service booking declined",
    completed: "Service completed",
    cancelled: "Service booking cancelled",
    payment_failed: "Service booking payment failed",
  };
  const asProvider: Record<string, string> = {
    pending: "New service booking request",
    accepted: "Booking accepted",
    declined: "Booking declined",
    completed: "Service completed",
    cancelled: "Service booking cancelled",
    payment_failed: "Service booking payment failed",
  };
  const map = role === "requester" ? asRequester : asProvider;
  return map[status] ?? "Service booking activity";
}

function formatServiceReviewerName(reviewer: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const parts = [reviewer.firstName, reviewer.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Someone";
}
