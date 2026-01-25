import Stripe from "stripe";
import { tryCatch } from "@walkup/walkup-utils";
import { PAYMENT_SERVER_INSTANCE } from "./server";

/**
 * Stripe Connect service for managing connected accounts
 */

/**
 * Components configuration for Stripe Connect account sessions
 */
export interface AccountSessionComponents {
  balances?: { enabled: boolean };
  payouts?: { enabled: boolean };
  payouts_list?: { enabled: boolean };
  payments?: { enabled: boolean };
  documents?: { enabled: boolean };
  notification_banner?: { enabled: boolean };
}

/**
 * Create an Express connected account for a user
 */
export async function createConnectedAccount(
  userId: string,
  email: string,
): Promise<Stripe.Account> {
  try {
    const account = await PAYMENT_SERVER_INSTANCE.accounts.create({
      type: "express",
      country: "US",
      email,
      metadata: {
        userId,
      },
    });

    return account;
  } catch (error) {
    console.error("Error creating connected account:", error);
    throw error;
  }
}

/**
 * Create an account session for embedded Stripe Connect components
 * Returns client secret for Connect components
 *
 * @param accountId - The Stripe Connect account ID
 * @param options - Optional configuration for account session components
 * @param options.components - Components to enable in the account session
 * @returns Promise resolving to the client secret string
 *
 * @example
 * // For onboarding (backward compatible)
 * const clientSecret = await createAccountSession(accountId);
 *
 * @example
 * // For payments page with multiple components
 * const clientSecret = await createAccountSession(accountId, {
 *   components: {
 *     balances: { enabled: true },
 *     payouts: { enabled: true },
 *     payments: { enabled: true },
 *   },
 * });
 */
export async function createAccountSession(
  accountId: string,
  options?: { components?: AccountSessionComponents },
): Promise<string> {
  // If no components specified, default to onboarding (backward compatibility)
  const components = options?.components
    ? {
        account_onboarding: {
          enabled: false,
        },
        ...options.components,
      }
    : {
        account_onboarding: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
      };

  const { data: clientSecret, error } = await tryCatch(
    PAYMENT_SERVER_INSTANCE.accountSessions
      .create({
        account: accountId,
        components,
      })
      .then((accountSession) => accountSession.client_secret),
  );

  if (error) {
    console.error("Error creating account session:", error);
    throw error;
  }

  if (!clientSecret) {
    throw new Error(
      "Failed to create account session: no client secret returned",
    );
  }

  return clientSecret;
}

/**
 * Get account status (charges_enabled, payouts_enabled)
 */
export async function getAccountStatus(accountId: string): Promise<{
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}> {
  try {
    const account = await PAYMENT_SERVER_INSTANCE.accounts.retrieve(accountId);

    return {
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
    };
  } catch (error) {
    console.error("Error getting account status:", error);
    throw error;
  }
}

/**
 * Create a login link for Express Dashboard access
 */
export async function createLoginLink(accountId: string): Promise<string> {
  try {
    const loginLink =
      await PAYMENT_SERVER_INSTANCE.accounts.createLoginLink(accountId);

    return loginLink.url;
  } catch (error) {
    console.error("Error creating login link:", error);
    throw error;
  }
}

/**
 * Create a customer portal session for managing payment methods and billing
 * Returns the portal URL that can be opened in a new tab
 *
 * @param customerId - The Stripe customer ID
 * @param options - Configuration options for the portal session
 * @param options.return_url - URL to redirect to after the customer exits the portal
 * @returns Promise resolving to the portal URL string
 *
 * @example
 * const portalUrl = await createCustomerPortalSession(customerId, {
 *   return_url: "https://app.hoador.com/dashboard/payments",
 * });
 */
export async function createCustomerPortalSession(
  customerId: string,
  options: { return_url: string },
): Promise<string> {
  const { data: portalUrl, error } = await tryCatch(
    PAYMENT_SERVER_INSTANCE.billingPortal.sessions
      .create({
        customer: customerId,
        return_url: options.return_url,
      })
      .then((session) => session.url),
  );

  if (error) {
    console.error("Error creating customer portal session:", error);
    throw error;
  }

  if (!portalUrl) {
    throw new Error(
      "Failed to create customer portal session: no URL returned",
    );
  }

  return portalUrl;
}
