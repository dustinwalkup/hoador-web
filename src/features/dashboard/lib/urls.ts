/**
 * URL helpers for dashboard widgets.
 * Used by PendingRequestsWidget and OverdueAlertsWidget for links to request/rental detail.
 */

/**
 * Builds the lending request detail URL for a given rental request id.
 * Links to the existing rental detail page with view=lending so the owner
 * can review and accept/decline the request.
 *
 * @param requestId - Rental request id (rental_requests.id)
 * @returns Path to the rental detail page with lending view, e.g. /dashboard/rental/abc?view=lending
 */
export function getLendingRequestDetailUrl(requestId: string): string {
  return `/dashboard/rental/${requestId}?view=lending`;
}
