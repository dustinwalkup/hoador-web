import type { RentalType } from "@/features/rentals/lib/types";

/**
 * Rental route configuration
 *
 * Available URLs:
 * - /dashboard/rentals/outgoing/requests, approved, active, completed, denied
 * - /dashboard/rentals/incoming/requests, approved, active, completed, denied
 */

export const RENTAL_ROUTES = {
  RENTING: {
    REQUESTS: "/dashboard/rentals/outgoing/requests",
    ACTIVE: "/dashboard/rentals/outgoing/active",
    COMPLETED: "/dashboard/rentals/outgoing/completed",
    DENIED: "/dashboard/rentals/outgoing/denied",
  },
  LENDING: {
    INCOMING: "/dashboard/rentals/incoming/requests",
    ACTIVE: "/dashboard/rentals/incoming/active",
    COMPLETED: "/dashboard/rentals/incoming/completed",
    DENIED: "/dashboard/rentals/incoming/denied",
  },
} as const;

export const DEFAULT_RENTAL_ROUTES = {
  renting: RENTAL_ROUTES.RENTING.REQUESTS,
  lending: RENTAL_ROUTES.LENDING.INCOMING,
} as const;

/**
 * Maps internal type + status to URL direction + status.
 * Lending "incoming" -> URL "requests"
 */
function toUrlDirectionAndStatus(
  type: RentalType,
  status: string,
): { direction: "incoming" | "outgoing"; status: string } {
  const direction = type === "lending" ? "incoming" : "outgoing";
  const urlStatus =
    type === "lending" && status === "incoming" ? "requests" : status;
  return { direction, status: urlStatus };
}

/**
 * Helper function to build rental route URLs
 */
export function buildRentalRoute(type: RentalType, status: string): string {
  const { direction, status: urlStatus } = toUrlDirectionAndStatus(
    type,
    status,
  );
  return `/dashboard/rentals/${direction}/${urlStatus}`;
}

/**
 * Helper function to get default route for a rental type
 */
export function getDefaultRentalRoute(type: RentalType): string {
  return DEFAULT_RENTAL_ROUTES[type];
}

/**
 * Helper function to validate rental route parameters (direction + status)
 */
export function isValidRentalRoute(direction: string, status: string): boolean {
  const validDirections = ["incoming", "outgoing"];
  const validStatuses = [
    "requests",
    "approved",
    "active",
    "completed",
    "denied",
  ];

  return validDirections.includes(direction) && validStatuses.includes(status);
}
