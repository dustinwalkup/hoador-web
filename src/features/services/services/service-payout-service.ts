import { serviceBookingDAL } from "@/dal";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { sendServicePayoutNotification } from "@/features/services/notifications/service-notifications";
import { createServiceTransfer } from "@/services/stripe/service-payments";

export interface PayoutSummary {
  eligible: number;
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Cron-driven payouts for completed service bookings (24h after completion).
 */
export class ServicePayoutService {
  /**
   * Claims eligible bookings and transfers net funds to provider Connect accounts.
   */
  static async processPayouts(batchSize: number): Promise<PayoutSummary> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const eligibleRows = await serviceBookingDAL.findEligibleForPayout(
      cutoff,
      batchSize,
    );

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const row of eligibleRows) {
      processed += 1;
      try {
        const claimed = await serviceBookingDAL.claimForPayoutProcessing(
          row.id,
        );
        if (!claimed) {
          continue;
        }

        if (!row.providerConnectedAccountId || !row.stripeChargeId) {
          await serviceBookingDAL.update(row.id, { payoutStatus: "failed" });
          await sendOpsAlert({
            event: "service_payout_missing_connect_or_charge",
            serviceBookingId: row.id,
            message:
              "Missing provider connected account or charge id for service payout",
            sendEmailAlert: true,
          });
          failed += 1;
          continue;
        }

        const transfer = await createServiceTransfer({
          bookingId: row.id,
          providerConnectedAccountId: row.providerConnectedAccountId,
          chargeId: row.stripeChargeId,
          servicePrice: Number(row.servicePrice),
          idempotencyKey: `service-transfer-${row.id}`,
        });

        if (!transfer.success) {
          await serviceBookingDAL.update(row.id, { payoutStatus: "failed" });
          await sendOpsAlert({
            event: "service_payout_transfer_failed",
            serviceBookingId: row.id,
            message: transfer.error,
            sendEmailAlert: true,
          });
          failed += 1;
          continue;
        }

        const updated = await serviceBookingDAL.update(row.id, {
          payoutStatus: "completed",
          stripeTransferId: transfer.transferId,
          ownerTransferredAt: new Date(),
        });

        await sendServicePayoutNotification(row.providerId, updated);

        succeeded += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : "Unknown payout error";
        await sendOpsAlert({
          event: "service_payout_unexpected_error",
          serviceBookingId: row.id,
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
}
