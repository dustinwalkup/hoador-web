import type Stripe from "stripe";
import { getLogger } from "@/lib/logger";
import { userDAL, paymentDAL, auditLogDAL, paymentLifecycleDAL } from "@/dal";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { tryCatch } from "@walkup/walkup-utils";

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

  switch (eventType) {
    case "account.updated":
      await handleAccountUpdated(event.data.object as Stripe.Account);
      break;
    case "account.closed":
      await handleAccountClosed(
        (event as unknown as { data: { object: Stripe.Account } }).data.object,
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
    case "transfer.failed":
      await handleTransferFailed(event.data.object as Stripe.Transfer);
      break;
    default:
      getLogger().info(
        { eventType },
        `Unhandled webhook event type: ${eventType}`,
      );
      break;
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
        linkUrl: "/dashboard/profile/payments",
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

async function handleTransferFailed(transfer: Stripe.Transfer): Promise<void> {
  const lifecycle = await paymentLifecycleDAL.getByTransferId(transfer.id);
  if (lifecycle) {
    await paymentLifecycleDAL.updateOwnerTransferStatus(
      lifecycle.rentalId,
      "failed",
    );
    await sendOpsAlert({
      event: "transfer_failed_webhook",
      rentalId: lifecycle.rentalId,
      message: `Owner transfer failed (detected via webhook): Transfer ${transfer.id}`,
      sendEmailAlert: true,
    });
  }
}
