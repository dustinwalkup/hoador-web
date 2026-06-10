import type Stripe from "stripe";
import { getLogger } from "@/lib/logger";
import { userDAL, paymentDAL, auditLogDAL, paymentLifecycleDAL } from "@/dal";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { tryCatch } from "@walkup/walkup-utils";
import { ChargebackService } from "./chargeback-service";

/**
 * Dispatch a Stripe webhook event to the appropriate handler.
 * Creates an audit log entry for every processed event.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const eventType = event.type as string;

  getLogger().info(
    { message: "webhook.received", eventId: event.id, eventType },
    "Stripe webhook received",
  );

  try {
    switch (eventType) {
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "account.closed":
        await handleAccountClosed(
          (event as unknown as { data: { object: Stripe.Account } }).data
            .object,
        );
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "payment_intent.canceled":
        await handlePaymentIntentCanceled(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "transfer.reversed":
        await handleTransferReversed(event.data.object as Stripe.Transfer);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        await ChargebackService.handleChargebackCreated(
          event.data.object as Stripe.Dispute,
        );
        break;
      case "charge.dispute.updated":
        await ChargebackService.handleChargebackUpdated(
          event.data.object as Stripe.Dispute,
        );
        break;
      case "charge.dispute.closed":
        await ChargebackService.handleChargebackClosed(
          event.data.object as Stripe.Dispute,
        );
        break;
      default:
        getLogger().info(
          { eventType },
          `Unhandled webhook event type: ${eventType}`,
        );
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    getLogger().error(
      {
        message: "webhook.handler_failed",
        eventId: event.id,
        eventType,
        error: errorMessage,
      },
      "Stripe webhook handler threw",
    );
    // Best-effort durable record. Its own failure must not mask the original
    // error, so swallow via tryCatch, then rethrow so the route returns 500
    // and Stripe retries.
    await tryCatch(
      auditLogDAL.create({
        entityType: "webhook",
        entityId: event.id,
        action: "webhook.failed",
        metadata: { eventType, error: errorMessage },
      }),
    );
    throw error;
  }

  await auditLogDAL.create({
    entityType: "webhook",
    entityId: event.id,
    action: "webhook.processed",
    metadata: { eventType },
  });
}

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  const { data: user, error: userError } = await tryCatch(
    userDAL.getUserByConnectedAccountId(account.id),
  );

  if (!userError && user) {
    await userDAL.updateConnectOnboardingStatus(user.id, {
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
    });
  }
}

async function handleAccountClosed(account: Stripe.Account): Promise<void> {
  const { data: user, error: userError } = await tryCatch(
    userDAL.getUserByConnectedAccountId(account.id),
  );

  if (!userError && user) {
    await userDAL.updateConnectOnboardingStatus(user.id, {
      chargesEnabled: false,
      payoutsEnabled: false,
    });
  }
}

async function handlePaymentIntentSucceeded(
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const existingPayment = await paymentDAL.getByPaymentIntentId(pi.id);

  if (existingPayment && existingPayment.status !== "succeeded") {
    await paymentDAL.updatePaymentStatus(existingPayment.id, "succeeded", {
      paidAt: existingPayment.paidAt ?? new Date(),
    });
  }
}

async function handlePaymentIntentFailed(
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const existingPayment = await paymentDAL.getByPaymentIntentId(pi.id);

  if (existingPayment && existingPayment.status !== "failed") {
    await paymentDAL.updatePaymentStatus(existingPayment.id, "failed");

    try {
      await sendNotification({
        userId: existingPayment.payerId,
        type: "payment_failed",
        title: "Payment Failed",
        message:
          "A payment for your rental has failed. Please update your payment method.",
        data: { rentalId: existingPayment.rentalId },
        linkUrl: "/dashboard/payments",
        category: "payments",
      });
    } catch (notifError) {
      getLogger().error(
        { error: String(notifError), paymentId: existingPayment.id },
        "Failed to send payment failure notification from webhook",
      );
    }
  }
}

async function handlePaymentIntentCanceled(
  pi: Stripe.PaymentIntent,
): Promise<void> {
  if (pi.metadata?.paymentType !== "security_deposit_hold") {
    return;
  }

  const rentalId = pi.metadata?.rentalId;
  if (!rentalId) {
    return;
  }

  const lifecycle = await paymentLifecycleDAL.getByRentalId(rentalId);
  if (lifecycle && lifecycle.depositHoldStatus !== "released") {
    await paymentLifecycleDAL.updateDepositHoldStatus(rentalId, "expired");
    await sendOpsAlert({
      event: "deposit_hold_expired_webhook",
      rentalId,
      message: `Deposit hold expired (detected via webhook): PaymentIntent ${pi.id}`,
      sendEmailAlert: true,
    });
  }
}

async function handleTransferReversed(
  transfer: Stripe.Transfer,
): Promise<void> {
  const lifecycle = await paymentLifecycleDAL.getByTransferId(transfer.id);
  if (lifecycle) {
    await paymentLifecycleDAL.updateOwnerTransferStatus(
      lifecycle.rentalId,
      "failed",
    );
    await sendOpsAlert({
      event: "transfer_reversed_webhook",
      rentalId: lifecycle.rentalId,
      message: `Owner transfer reversed (detected via webhook): Transfer ${transfer.id}`,
      sendEmailAlert: true,
    });
  }
}

/**
 * Sync payment record when a charge is refunded (e.g. from Stripe Dashboard or our refund).
 * Idempotent: if payment is already marked refunded, no-op.
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    getLogger().warn(
      { chargeId: charge.id },
      "charge.refunded webhook: no payment_intent on charge",
    );
    return;
  }

  const payment = await paymentDAL.getByPaymentIntentId(paymentIntentId);
  if (!payment) {
    getLogger().warn(
      { chargeId: charge.id, paymentIntentId },
      "charge.refunded webhook: no payment record found",
    );
    return;
  }

  if (payment.status === "refunded") {
    return;
  }

  const refundAmountDollars = (charge.amount_refunded / 100).toFixed(2);
  await paymentDAL.recordRefund(payment.id, {
    refundedAt: new Date(),
    refundAmount: refundAmountDollars,
    refundReason: (charge.metadata?.reason as string) || "stripe_webhook",
  });
}
