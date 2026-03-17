import { paymentLifecycleDAL } from "@/dal";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";

const STALE_PROCESSING_THRESHOLD_MINUTES_ENV =
  "STALE_PROCESSING_THRESHOLD_MINUTES";
const DEFAULT_THRESHOLD_MINUTES = 60;

export interface StaleProcessingResult {
  staleCount: number;
  rentalIds: string[];
  thresholdMinutes: number;
}

/**
 * Detects lifecycle records stuck in payoutStatus 'processing' beyond a threshold
 * and sends an ops alert (Phase 4 — Requirements 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3).
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
};
