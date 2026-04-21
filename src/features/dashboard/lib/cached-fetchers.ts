import { cache } from "react";
import { messagesDAL, rentalDAL, serviceBookingDAL } from "@/dal";

/**
 * Request-deduped wrappers for DAL calls that are independently invoked by
 * multiple dashboard widgets in the same RSC render pass. React `cache()`
 * memoizes by argument reference equality within a single request, so two
 * widgets calling the same fetcher fire only one DB query.
 *
 * Note on query-tracker attribution: a deduped call is billed to whichever
 * widget's `runWithQueryCounter` scope hits the underlying DAL first. Total
 * counts drop, but per-widget breakdowns may look uneven across runs.
 */

export const getUnreadMessageCountCached = cache((userId: string) =>
  messagesDAL.getUnreadMessageCount(userId),
);

export const getBorrowedListingsCached = cache((userId: string) =>
  rentalDAL.getBorrowedListings(userId),
);

export const getLendingRequestsByStatusCached = cache(
  (
    status: Parameters<typeof rentalDAL.getLendingRequestsByStatus>[0],
    userId: string,
  ) => rentalDAL.getLendingRequestsByStatus(status, userId),
);

export const getActionableAlertsCached = cache((userId: string) =>
  rentalDAL.getActionableAlerts(userId),
);

export const findServiceBookingsByRequesterCached = cache((userId: string) =>
  serviceBookingDAL.findByRequesterForDashboard(userId),
);

export const findServiceBookingsByProviderCached = cache((userId: string) =>
  serviceBookingDAL.findByProviderForDashboard(userId),
);
