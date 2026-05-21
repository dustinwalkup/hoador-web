import { rentalDAL, serviceBookingDAL, userDAL } from "@/dal";
import { releaseDepositHold } from "@/services/stripe/deposit-hold";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { getLogger } from "@/lib/logger";
import { getPayoutReadiness } from "./payout-readiness";
import { logGatingEvent } from "./log-events";

export interface ExpirePendingBookingsResult {
  rentalsChecked: number;
  servicesChecked: number;
  expiredCount: number;
  failedCount: number;
}

/**
 * Auto-cancel pending rental requests and service bookings whose `expiresAt`
 * has passed. Triggered hourly by /api/cron/expire-pending-bookings.
 *
 * Per-row try/catch — one failing row does not stop the batch.
 */
export async function expirePendingBookings(
  now: Date = new Date(),
): Promise<ExpirePendingBookingsResult> {
  const [pendingRentals, pendingServices] = await Promise.all([
    rentalDAL.findPendingExpiredRequests(now),
    serviceBookingDAL.findPendingExpired(now),
  ]);

  let expiredCount = 0;
  let failedCount = 0;

  for (const row of pendingRentals) {
    try {
      const updated = await rentalDAL.markRequestExpired(row.id);
      if (!updated) continue;
      expiredCount++;
      await processExpiredRental(row);
    } catch (error) {
      failedCount++;
      getLogger().error(
        { err: error, bookingType: "rental", bookingId: row.id },
        "expire-pending-bookings: rental row failed",
      );
    }
  }

  for (const row of pendingServices) {
    try {
      const updated = await serviceBookingDAL.markExpired(row.id);
      if (!updated) continue;
      expiredCount++;
      await processExpiredService(row);
    } catch (error) {
      failedCount++;
      getLogger().error(
        { err: error, bookingType: "service", bookingId: row.id },
        "expire-pending-bookings: service row failed",
      );
    }
  }

  return {
    rentalsChecked: pendingRentals.length,
    servicesChecked: pendingServices.length,
    expiredCount,
    failedCount,
  };
}

async function processExpiredRental(row: {
  id: string;
  renterId: string;
  ownerId: string;
  listingId: string;
  listingName: string;
  securityDepositAuthId: string | null;
}): Promise<void> {
  if (row.securityDepositAuthId) {
    try {
      await releaseDepositHold(row.securityDepositAuthId);
    } catch (error) {
      getLogger().error(
        {
          err: error,
          bookingType: "rental",
          bookingId: row.id,
          paymentIntentId: row.securityDepositAuthId,
        },
        "expire-pending-bookings: deposit hold release failed",
      );
    }
  }

  const owner = await userDAL.getUserById(row.ownerId);
  const ownerStatus = owner
    ? getPayoutReadiness(owner).onboardingStatus
    : "unknown";

  await sendNotification({
    userId: row.renterId,
    type: "rental_cancelled",
    title: "Rental request expired",
    message: `Your request for ${row.listingName} was cancelled because the owner did not respond in time.`,
    data: { rentalRequestId: row.id, listingId: row.listingId },
    linkUrl: `/dashboard/rental/${row.id}`,
  });

  const ownerNotPayoutReady = ownerStatus !== "verified";
  await sendNotification({
    userId: row.ownerId,
    type: "rental_cancelled",
    title: "Pending request expired",
    message: ownerNotPayoutReady
      ? `Your pending request for ${row.listingName} expired. Set up your payout account so you can accept future bookings the moment they come in.`
      : `Your pending request for ${row.listingName} expired without acceptance.`,
    data: { rentalRequestId: row.id, listingId: row.listingId },
    linkUrl: ownerNotPayoutReady
      ? `/dashboard/payments/earnings-and-payouts`
      : `/dashboard/rental/${row.id}`,
  });

  if (ownerNotPayoutReady) {
    logGatingEvent("pending_booking_expired_owner_not_ready", {
      userId: row.ownerId,
      bookingType: "rental",
      bookingId: row.id,
      listingId: row.listingId,
      onboardingStatus: ownerStatus,
    });
  }
}

async function processExpiredService(row: {
  id: string;
  requesterId: string;
  providerId: string;
  listingId: string;
  listingTitle: string;
}): Promise<void> {
  const provider = await userDAL.getUserById(row.providerId);
  const providerStatus = provider
    ? getPayoutReadiness(provider).onboardingStatus
    : "unknown";

  await sendNotification({
    userId: row.requesterId,
    type: "service_booking_declined",
    title: "Booking request expired",
    message: `Your booking request for "${row.listingTitle}" was cancelled because the provider did not respond in time.`,
    data: { bookingId: row.id, listingId: row.listingId },
    linkUrl: `/dashboard/services/bookings/${row.id}`,
  });

  const providerNotPayoutReady = providerStatus !== "verified";
  await sendNotification({
    userId: row.providerId,
    type: "service_booking_declined",
    title: "Pending booking expired",
    message: providerNotPayoutReady
      ? `Your pending booking for "${row.listingTitle}" expired. Set up your payout account so you can accept future bookings the moment they come in.`
      : `Your pending booking for "${row.listingTitle}" expired without acceptance.`,
    data: { bookingId: row.id, listingId: row.listingId },
    linkUrl: providerNotPayoutReady
      ? `/dashboard/payments/earnings-and-payouts`
      : `/dashboard/services/bookings/${row.id}`,
  });

  if (providerNotPayoutReady) {
    logGatingEvent("pending_booking_expired_owner_not_ready", {
      userId: row.providerId,
      bookingType: "service",
      bookingId: row.id,
      listingId: row.listingId,
      onboardingStatus: providerStatus,
    });
  }
}
