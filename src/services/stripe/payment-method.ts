import type Stripe from "stripe";
import { PAYMENT_SERVER_INSTANCE } from "./server";
import { paymentLifecycleDAL } from "@/dal";

/**
 * Recover failed deposit holds after a payment method change.
 * Resets failed deposits to "scheduled" so the next cron run retries them.
 * Never throws — catches and logs errors internally.
 */
export async function recoverFailedDeposits(renterId: string): Promise<void> {
  try {
    const failedDeposits =
      await paymentLifecycleDAL.findFailedDepositsForRenter(renterId);
    for (const deposit of failedDeposits) {
      await paymentLifecycleDAL.updateDepositHoldStatus(
        deposit.rentalId,
        "scheduled",
      );
    }
  } catch (error) {
    console.error("Error resetting failed deposits:", error);
  }
}

/**
 * Attach a payment method to a Stripe customer, then recover any failed deposits.
 */
export async function attachPaymentMethod(
  customerId: string,
  paymentMethodId: string,
  renterId: string,
): Promise<Stripe.PaymentMethod> {
  const paymentMethod = await PAYMENT_SERVER_INSTANCE.paymentMethods.attach(
    paymentMethodId,
    { customer: customerId },
  );

  await recoverFailedDeposits(renterId);

  return paymentMethod;
}

/**
 * Set a payment method as the default for a Stripe customer, then recover any failed deposits.
 */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string,
  renterId: string,
): Promise<void> {
  await PAYMENT_SERVER_INSTANCE.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  await recoverFailedDeposits(renterId);
}

/**
 * Detach a payment method from a Stripe customer.
 */
export async function detachPaymentMethod(
  paymentMethodId: string,
): Promise<void> {
  await PAYMENT_SERVER_INSTANCE.paymentMethods.detach(paymentMethodId);
}
