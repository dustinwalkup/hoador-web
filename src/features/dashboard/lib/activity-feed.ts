/**
 * Dashboard activity feed: composite of recent rental activity, reviews, listing updates,
 * and services (bookings, service reviews, service listings).
 * @see specs/dashboard/2-design.md getDashboardActivityFeed
 */

import {
  listingDAL,
  rentalDAL,
  serviceBookingDAL,
  serviceListingDAL,
} from "@/dal";
import { formatDistanceToNow } from "@/lib/utils/date.utils";
import type { ActivityFeedItem } from "@/features/dashboard/types";

type MaybePromise<T> = T | Promise<T>;

/**
 * Sources the dashboard summary route also reads for other keys. Passed in (as
 * values or in-flight promises), they're used instead of a second query.
 */
export interface ActivityFeedSources {
  serviceBookingsAsRequester: MaybePromise<
    Awaited<ReturnType<typeof serviceBookingDAL.findByRequesterForDashboard>>
  >;
  serviceBookingsAsProvider: MaybePromise<
    Awaited<ReturnType<typeof serviceBookingDAL.findByProviderForDashboard>>
  >;
  serviceListingsOwned: MaybePromise<
    Awaited<ReturnType<typeof serviceListingDAL.findByProvider>>
  >;
}

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
 * @param prefetched - Shared sources the caller already fetched; omitted, they're fetched here
 * @returns ActivityFeedItem[] with title, description, timestamp, relativeTime, linkTo
 */
export async function getDashboardActivityFeed(
  userId: string,
  limit: number,
  prefetched?: ActivityFeedSources,
): Promise<ActivityFeedItem[]> {
  const fetchLimit = Math.max(limit * 2, 20);

  const [
    rentalActivity,
    userListings,
    serviceBookingsAsRequester,
    serviceBookingsAsProvider,
    serviceListingsOwned,
  ] = await Promise.all([
    rentalDAL.getRecentRentalActivity(userId, fetchLimit),
    // Newest `limit` by updatedAt, as the loop below needs — not every
    // listing with its images and ratings.
    listingDAL.getUserListingsForFeed(userId, limit),
    prefetched?.serviceBookingsAsRequester ??
      serviceBookingDAL.findByRequesterForDashboard(userId, {
        limit: fetchLimit,
      }),
    prefetched?.serviceBookingsAsProvider ??
      serviceBookingDAL.findByProviderForDashboard(userId, {
        limit: fetchLimit,
      }),
    prefetched?.serviceListingsOwned ??
      serviceListingDAL.findByProvider(userId),
  ]);

  const raw: RawFeedItem[] = [];

  for (const r of rentalActivity) {
    const title = formatRentalActivityTitle(
      r.status,
      r.role,
      r.approvedAt !== null,
    );
    const description = `${r.listingName}`;
    raw.push({
      id: `rental-${r.id}`,
      timestamp: r.updatedAt,
      title,
      description,
      linkTo: r.linkTo,
    });
  }

  for (const listing of userListings) {
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
    const title = formatServiceBookingTitle(
      row.status,
      "requester",
      bookingWasAccepted(row),
    );
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
    const title = formatServiceBookingTitle(
      row.status,
      "provider",
      bookingWasAccepted(row),
    );
    raw.push({
      id: `service-booking-${row.id}`,
      timestamp: row.updatedAt,
      title,
      description: row.listingTitle,
      linkTo: `/dashboard/services/bookings/${row.id}`,
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

/**
 * Human-readable title for a rental row, from the viewer's side.
 *
 * Neighbor decisions use the guideline's words (TERMINOLOGY-GUIDELINES §4):
 * owners **accept** and **decline** — "approved"/"denied" are the enum names,
 * and "Approved" is reserved for Hoador moderation. A request is not yet a
 * rental, so `cancelled` reads "Rental cancelled" only once the owner had
 * accepted it (`approvedAt` set) — the enum alone can't tell the two apart.
 */
function formatRentalActivityTitle(
  status: string,
  role: "renter" | "owner",
  wasAccepted: boolean,
): string {
  if (status === "cancelled") {
    if (wasAccepted) return "Rental cancelled";
    return role === "renter" ? "Rental request cancelled" : "Request cancelled";
  }
  const asRenter: Record<string, string> = {
    pending: "Rental request sent",
    approved: "Rental request accepted",
    active: "Rental started",
    overdue: "Rental overdue",
    completed: "Rental completed",
    denied: "Rental request declined",
  };
  const asOwner: Record<string, string> = {
    pending: "New rental request",
    approved: "Request accepted",
    active: "Rental started",
    overdue: "Rental overdue",
    completed: "Rental completed",
    denied: "Request declined",
  };
  const map = role === "renter" ? asRenter : asOwner;
  return map[status] ?? "Rental activity";
}

/**
 * Whether a booking was ever accepted. `accepted_at` arrived later and its
 * backfill was partial, so a completed booking or a successful charge (written
 * only by the accept path) also counts — the rule mobile's booking Timeline
 * uses.
 */
function bookingWasAccepted(row: {
  acceptedAt: Date | null;
  completedAt?: Date | null;
  paymentStatus: string | null;
}): boolean {
  if (row.acceptedAt || row.completedAt) return true;
  return Boolean(row.paymentStatus) && row.paymentStatus !== "failed";
}

/**
 * Human-readable title for a service booking row based on status and perspective.
 *
 * "Booking" is already a service word, so these never say "service booking"
 * (TERMINOLOGY-GUIDELINES §3.2); an unanswered one is a **booking request**.
 *
 * @param status - Booking status from `service_booking_status`
 * @param role - Whether the current user is the client (`requester`) or the provider
 * @param wasAccepted - Whether the provider had accepted it (see `bookingWasAccepted`)
 */
function formatServiceBookingTitle(
  status: string,
  role: "requester" | "provider",
  wasAccepted: boolean,
): string {
  if (status === "cancelled") {
    return wasAccepted ? "Booking cancelled" : "Booking request cancelled";
  }
  const asRequester: Record<string, string> = {
    pending: "Booking request sent",
    accepted: "Booking request accepted",
    declined: "Booking request declined",
    completed: "Service completed",
    payment_failed: "Booking payment failed",
  };
  const asProvider: Record<string, string> = {
    pending: "New booking request",
    accepted: "Request accepted",
    declined: "Request declined",
    completed: "Service completed",
    payment_failed: "Booking payment failed",
  };
  const map = role === "requester" ? asRequester : asProvider;
  return map[status] ?? "Booking activity";
}
