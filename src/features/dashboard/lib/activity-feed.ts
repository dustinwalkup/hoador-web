/**
 * Dashboard activity feed: composite of recent rental activity, reviews, and listing updates.
 * @see specs/dashboard/2-design.md getDashboardActivityFeed
 */

import { rentalDAL, reviewDAL, listingDAL } from "@/dal";
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
 * completed rentals, new/updated listings, and reviews received. Sorted by date desc.
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

  const [rentalActivity, reviewsReceived, userListings] = await Promise.all([
    rentalDAL.getRecentRentalActivity(userId, fetchLimit),
    reviewDAL.getRecentReviews(userId, { limit: fetchLimit }),
    listingDAL.getUserListings(userId),
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
