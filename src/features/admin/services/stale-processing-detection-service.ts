import { paymentLifecycleDAL, rentalDAL, serviceBookingDAL } from "@/dal";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";

const STALE_PROCESSING_THRESHOLD_MINUTES_ENV =
  "STALE_PROCESSING_THRESHOLD_MINUTES";
const DEFAULT_THRESHOLD_MINUTES = 60;
/** A charge takes seconds; a claim older than this was never released. */
const DEFAULT_CHARGE_CLAIM_THRESHOLD_MINUTES = 15;

export interface StaleProcessingResult {
  staleCount: number;
  rentalIds: string[];
  thresholdMinutes: number;
}

export interface StaleChargeClaimResult {
  staleCount: number;
  rentalRequestIds: string[];
  serviceBookingIds: string[];
  thresholdMinutes: number;
}

/**
 * Detects records stuck in a 'processing' claim beyond a threshold and sends an
 * ops alert: rental payouts (Phase 4 — Requirements 4.1, 4.2, 4.3, 4.4, 5.1, 5.2,
 * 5.3), and rental-approval / service-accept charge claims.
 */
export const StaleProcessingDetectionService = {
  /**
   * Find stale processing records and send ops alert if any are found.
   * Threshold: STALE_PROCESSING_THRESHOLD_MINUTES env (default 60), or pass explicitly.
   *
   * @param thresholdMinutes - Optional override; otherwise read from env
   * @returns { staleCount, rentalIds, thresholdMinutes }
   */
  async detectStaleProcessing(
    thresholdMinutes?: number,
  ): Promise<StaleProcessingResult> {
    const resolvedThreshold =
      thresholdMinutes ??
      (parseInt(
        process.env[STALE_PROCESSING_THRESHOLD_MINUTES_ENV] ?? "",
        10,
      ) ||
        DEFAULT_THRESHOLD_MINUTES);

    const records =
      await paymentLifecycleDAL.findStaleProcessingRecords(resolvedThreshold);
    const rentalIds = records.map((r) => r.rentalId);
    const staleCount = rentalIds.length;

    if (staleCount > 0) {
      await sendOpsAlert({
        event: "stale_processing_detected",
        rentalId: rentalIds[0]!,
        message: `${staleCount} rental(s) stuck in payout processing for >${resolvedThreshold} minutes`,
        metadata: {
          staleCount,
          rentalIds,
          thresholdMinutes: resolvedThreshold,
        },
        sendEmailAlert: true,
      });
    }

    return {
      staleCount,
      rentalIds,
      thresholdMinutes: resolvedThreshold,
    };
  },

  /**
   * Find rental requests and service bookings whose approve/accept charge
   * claim (`paymentStatus = 'processing'`) was never released, and alert ops.
   * Alert only: the charge may have succeeded, so completing the approval or
   * refunding is a human call. The claim is left in place, which keeps the
   * request out of re-approval (and out of the pending-expiry cron).
   *
   * @param thresholdMinutes - Claim age before it counts as stale (default 15)
   */
  async detectStaleChargeClaims(
    thresholdMinutes: number = DEFAULT_CHARGE_CLAIM_THRESHOLD_MINUTES,
  ): Promise<StaleChargeClaimResult> {
    const [requests, bookings] = await Promise.all([
      rentalDAL.findStaleProcessingRequests(thresholdMinutes),
      serviceBookingDAL.findStaleProcessingBookings(thresholdMinutes),
    ]);
    const rentalRequestIds = requests.map((r) => r.id);
    const serviceBookingIds = bookings.map((b) => b.id);
    const staleCount = rentalRequestIds.length + serviceBookingIds.length;

    if (staleCount > 0) {
      await sendOpsAlert({
        event: "stale_charge_claim_detected",
        message:
          `${rentalRequestIds.length} rental request(s) and ${serviceBookingIds.length} service booking(s) ` +
          `stuck in paymentStatus 'processing' for >${thresholdMinutes} minutes. ` +
          "For each, find the PaymentIntent in Stripe (metadata rentalRequestId / bookingId). " +
          "If it succeeded, complete the approval or refund it; if there is none, set paymentStatus to 'failed' so it can be retried.",
        metadata: {
          staleCount,
          rentalRequestIds,
          serviceBookingIds,
          thresholdMinutes,
        },
        sendEmailAlert: true,
      });
    }

    return {
      staleCount,
      rentalRequestIds,
      serviceBookingIds,
      thresholdMinutes,
    };
  },
};
