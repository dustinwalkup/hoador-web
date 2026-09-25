import type { ServiceBookingDashboardRow } from "@/dal/service-booking.dal";
import type { ServicePaymentLifecycleRecord } from "@/db/schemas/service-payment-lifecycle.schema";

/**
 * Payment identifiers the dashboard row carries only because the DAL selects
 * the whole `service_bookings` row (PRIV-04). No list consumer reads them, and
 * `selectedPaymentMethodId` is what made SEC-07's detach attack possible: a
 * provider could read the requester's `pm_` id off this list.
 */
type SensitiveBookingField =
  | "stripePaymentIntentId"
  | "stripeChargeId"
  | "stripeRefundId"
  | "selectedPaymentMethodId";

export type ServiceBookingListItem = Omit<
  ServiceBookingDashboardRow,
  SensitiveBookingField
>;

/**
 * The booking-list wire shape, for `GET /api/services/bookings` and the web
 * services page's hydrated cache. An allowlist, not a rest spread: a column
 * added to `service_bookings` later fails type-check here until someone
 * decides whether clients may see it.
 */
export function toServiceBookingListItem(
  row: ServiceBookingDashboardRow,
): ServiceBookingListItem {
  return {
    id: row.id,
    listingId: row.listingId,
    requesterId: row.requesterId,
    providerId: row.providerId,
    communityId: row.communityId,
    proposedDate: row.proposedDate,
    proposedTime: row.proposedTime,
    hours: row.hours,
    notes: row.notes,
    declineReason: row.declineReason,
    acceptedAt: row.acceptedAt,
    declinedAt: row.declinedAt,
    servicePrice: row.servicePrice,
    serviceFee: row.serviceFee,
    totalAmount: row.totalAmount,
    status: row.status,
    paymentStatus: row.paymentStatus,
    refundAmount: row.refundAmount,
    cancelledAt: row.cancelledAt,
    cancelledBy: row.cancelledBy,
    cancellationReason: row.cancellationReason,
    completedAt: row.completedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    listingTitle: row.listingTitle,
    counterparty: {
      id: row.counterparty.id,
      firstName: row.counterparty.firstName,
      lastName: row.counterparty.lastName,
      profileImageUrl: row.counterparty.profileImageUrl,
    },
  };
}

/** The platform's Stripe ids; the provider needs the payout state, not these. */
type SensitiveLifecycleField = "chargeId" | "stripeTransferId";

export type ServiceBookingLifecycleResponse = Omit<
  ServicePaymentLifecycleRecord,
  SensitiveLifecycleField
>;

/** Allowlisted like `toServiceBookingListItem`, for the same reason (PRIV-04). */
export function toServiceBookingLifecycleResponse(
  record: ServicePaymentLifecycleRecord,
): ServiceBookingLifecycleResponse {
  return {
    id: record.id,
    bookingId: record.bookingId,
    providerPayout: record.providerPayout,
    ownerTransferStatus: record.ownerTransferStatus,
    payoutStatus: record.payoutStatus,
    ownerTransferredAt: record.ownerTransferredAt,
    transferAmount: record.transferAmount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
