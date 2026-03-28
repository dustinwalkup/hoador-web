/**
 * Shared types for HOA Services marketplace services (audit + API input).
 */

/** Passed from API routes for audit log correlation. */
export interface AuditContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Create listing payload (validated at route with Zod in Phase 6). */
export interface CreateListingInput {
  communityId: string;
  categoryId: string;
  title: string;
  description: string;
  pricingType: "fixed" | "hourly";
  price: number;
  ownerPoliciesAcknowledged: boolean;
  serviceNotes?: string | null;
}

/** Create booking payload. */
export interface CreateBookingInput {
  listingId: string;
  proposedDate: string;
  proposedTime: string;
  hours?: number | null;
  notes?: string | null;
}
