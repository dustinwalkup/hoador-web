import type Stripe from "stripe";
import { PAYMENT_SERVER_INSTANCE } from "./server";
import { paymentLifecycleDAL, userDAL } from "@/dal";

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
 * Resolve the Stripe customer ID and default card for a user.
 * Checks Stripe directly — the local userPaymentMethods table is not the source of truth.
 * Returns null if no Stripe customer or no card on file.
 */
export async function getStripeCustomerContext(
  userId: string,
): Promise<{ customerId: string; paymentMethodId: string } | null> {
  const customerId = await userDAL.getStripeCustomerId(userId);
  if (!customerId) return null;

  const customer = await PAYMENT_SERVER_INSTANCE.customers.retrieve(customerId);
  if (customer.deleted) return null;

  const defaultPmId =
    typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : null;

  if (defaultPmId) return { customerId, paymentMethodId: defaultPmId };

  // Fallback: first card attached to the customer
  const { data } = await PAYMENT_SERVER_INSTANCE.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });

  if (!data[0]) return null;
  return { customerId, paymentMethodId: data[0].id };
}

/**
 * Card payment methods for a user, formatted for booking/checkout UIs.
 *
 * @param userId - Application user id
 * @returns Empty array if no Stripe customer, customer deleted, or no cards; otherwise
 *   card payment methods with `isDefault` from the customer’s default payment method.
 */
export async function listStripeCardPaymentMethodsForUser(
  userId: string,
): Promise<
  Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }>
> {
  const customerId = await userDAL.getStripeCustomerId(userId);
  if (!customerId) return [];

  const customer = await PAYMENT_SERVER_INSTANCE.customers.retrieve(customerId);
  if (customer.deleted) return [];

  const defaultPmId =
    typeof customer.invoice_settings?.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : (customer.invoice_settings?.default_payment_method?.id ?? null);

  const { data } = await PAYMENT_SERVER_INSTANCE.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  return data
    .filter((pm) => pm.card)
    .map((pm) => ({
      id: pm.id,
      brand: pm.card!.brand,
      last4: pm.card!.last4,
      expMonth: pm.card!.exp_month,
      expYear: pm.card!.exp_year,
      isDefault: defaultPmId === pm.id,
    }));
}

/**
 * Detach a payment method from a Stripe customer.
 */
export async function detachPaymentMethod(
  paymentMethodId: string,
): Promise<void> {
  await PAYMENT_SERVER_INSTANCE.paymentMethods.detach(paymentMethodId);
}
