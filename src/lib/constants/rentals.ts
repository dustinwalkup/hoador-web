import type { RentalType } from "@/lib/types/rentals";

/**
 * Rental route configuration
 *
 * Available URLs:
 * - /dashboard/rentals/renting/requests
 * - /dashboard/rentals/renting/active
 * - /dashboard/rentals/renting/completed
 * - /dashboard/rentals/renting/rejected
 * - /dashboard/rentals/lending/incoming
 * - /dashboard/rentals/lending/active
 * - /dashboard/rentals/lending/completed
 * - /dashboard/rentals/lending/rejected
 */

export const RENTAL_ROUTES = {
  RENTING: {
    REQUESTS: "/dashboard/rentals/renting/requests",
    ACTIVE: "/dashboard/rentals/renting/active",
    COMPLETED: "/dashboard/rentals/renting/completed",
    REJECTED: "/dashboard/rentals/renting/rejected",
  },
  LENDING: {
    INCOMING: "/dashboard/rentals/lending/incoming",
    ACTIVE: "/dashboard/rentals/lending/active",
    COMPLETED: "/dashboard/rentals/lending/completed",
    REJECTED: "/dashboard/rentals/lending/rejected",
  },
} as const;

export const DEFAULT_RENTAL_ROUTES = {
  renting: RENTAL_ROUTES.RENTING.REQUESTS,
  lending: RENTAL_ROUTES.LENDING.INCOMING,
} as const;

/**
 * Helper function to build rental route URLs
 */
export function buildRentalRoute(type: RentalType, status: string): string {
  return `/dashboard/rentals/${type}/${status}`;
}

/**
 * Helper function to get default route for a rental type
 */
export function getDefaultRentalRoute(type: RentalType): string {
  return DEFAULT_RENTAL_ROUTES[type];
}

/**
 * Helper function to validate rental route parameters
 */
export function isValidRentalRoute(type: string, status: string): boolean {
  const validTypes = ["renting", "lending"];
  const validStatuses = {
    renting: ["requests", "active", "completed", "rejected"],
    lending: ["incoming", "active", "completed", "rejected"],
  };

  return (
    validTypes.includes(type) &&
    validStatuses[type as keyof typeof validStatuses]?.includes(status)
  );
}
