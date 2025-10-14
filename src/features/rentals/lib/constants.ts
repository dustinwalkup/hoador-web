import type { RentalType } from "@/features/rentals/lib/types";

/**
 * Rental route configuration
 *
 * Available URLs:
 * - /dashboard/renting/requests
 * - /dashboard/renting/active
 * - /dashboard/renting/completed
 * - /dashboard/renting/denied
 * - /dashboard/lending/incoming
 * - /dashboard/lending/active
 * - /dashboard/lending/completed
 * - /dashboard/lending/denied
 */

export const RENTAL_ROUTES = {
  RENTING: {
    REQUESTS: "/dashboard/renting/requests",
    ACTIVE: "/dashboard/renting/active",
    COMPLETED: "/dashboard/renting/completed",
    DENIED: "/dashboard/renting/denied",
  },
  LENDING: {
    INCOMING: "/dashboard/lending/incoming",
    ACTIVE: "/dashboard/lending/active",
    COMPLETED: "/dashboard/lending/completed",
    DENIED: "/dashboard/lending/denied",
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
  return `/dashboard/${type}/${status}`;
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
    renting: ["requests", "active", "completed", "denied"],
    lending: ["incoming", "active", "completed", "denied"],
  };

  return (
    validTypes.includes(type) &&
    validStatuses[type as keyof typeof validStatuses]?.includes(status)
  );
}
