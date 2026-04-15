import { serviceBookingDAL, servicePaymentLifecycleDAL } from "@/dal";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { sendServicePayoutNotification } from "@/features/services/notifications/service-notifications";
import { createServiceTransfer } from "@/services/stripe/service-payments";

export interface ServicePayoutSummary {
  eligible: number;
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Service booking payment lifecycle: provider Connect payouts and operational hooks.
 */
export class ServicePaymentLifecycleService {
  /**
   * Claims eligible bookings and transfers net funds to provider Connect accounts.
   */
  static async processPayouts(
    batchSize: number,
  ): Promise<ServicePayoutSummary> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const eligibleRows = await servicePaymentLifecycleDAL.findEligibleForPayout(
      cutoff,
      batchSize,
    );

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const row of eligibleRows) {
      processed += 1;
      try {
        const claimed = await servicePaymentLifecycleDAL.claimForProcessing(
          row.bookingId,
        );
        if (!claimed) {
          continue;
        }

        const chargeId =
          row.lifecycle.chargeId ??
          (await serviceBookingDAL.getById(row.bookingId))?.stripeChargeId ??
          null;

        if (!row.providerConnectedAccountId || !chargeId) {
          await servicePaymentLifecycleDAL.updatePayoutStatus(
            row.bookingId,
            "failed",
          );
          await sendOpsAlert({
            event: "service_payout_missing_connect_or_charge",
            serviceBookingId: row.bookingId,
            message:
              "Missing provider connected account or charge id for service payout",
            sendEmailAlert: true,
          });
          failed += 1;
          continue;
        }

        const transfer = await createServiceTransfer({
          bookingId: row.bookingId,
          providerConnectedAccountId: row.providerConnectedAccountId,
          chargeId,
          providerPayoutAmount: Number(row.providerPayout),
          idempotencyKey: `service-transfer-${row.bookingId}`,
        });

        if (!transfer.success) {
          await servicePaymentLifecycleDAL.updatePayoutStatus(
            row.bookingId,
            "failed",
          );
          await sendOpsAlert({
            event: "service_payout_transfer_failed",
            serviceBookingId: row.bookingId,
            message: transfer.error,
            sendEmailAlert: true,
          });
          failed += 1;
          continue;
        }

        await servicePaymentLifecycleDAL.updateOwnerTransferStatus(
          row.bookingId,
          "completed",
          {
            stripeTransferId: transfer.transferId,
            ownerTransferredAt: new Date(),
            transferAmount: Number(row.providerPayout),
          },
        );
        await servicePaymentLifecycleDAL.updatePayoutStatus(
          row.bookingId,
          "completed",
        );

        const updatedBooking = await serviceBookingDAL.getById(row.bookingId);
        if (updatedBooking) {
          await sendServicePayoutNotification(row.providerId, updatedBooking);
        }

        succeeded += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : "Unknown payout error";
        await sendOpsAlert({
          event: "service_payout_unexpected_error",
          serviceBookingId: row.bookingId,
          message,
          sendEmailAlert: true,
        });
      }
    }

    return {
      eligible: eligibleRows.length,
      processed,
      succeeded,
      failed,
    };
  }

  /**
   * Alerts ops when lifecycle rows are stuck in payout processing (single aggregated alert).
   */
  static async detectStaleProcessing(thresholdMinutes: number = 60): Promise<{
    staleCount: number;
    bookingIds: string[];
    thresholdMinutes: number;
  }> {
    const records =
      await servicePaymentLifecycleDAL.findStaleProcessingRecords(
        thresholdMinutes,
      );
    const bookingIds = records.map((r) => r.bookingId);
    const staleCount = bookingIds.length;

    if (staleCount > 0) {
      await sendOpsAlert({
        event: "service_stale_processing_detected",
        serviceBookingId: bookingIds[0]!,
        message: `${staleCount} service booking(s) stuck in payout processing for >${thresholdMinutes} minutes`,
        sendEmailAlert: true,
        metadata: {
          staleCount,
          bookingIds,
          thresholdMinutes,
        },
      });
    }

    return { staleCount, bookingIds, thresholdMinutes };
  }
}
