import Stripe from "stripe";
import { PAYMENT_SERVER_INSTANCE } from "./server";

/**
 * Stripe Connect service for managing connected accounts
 */

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
 * Create an account session for embedded onboarding
 * Returns client secret for ConnectAccountOnboarding component
 */
export async function createAccountSession(accountId: string): Promise<string> {
  try {
    const accountSession = await PAYMENT_SERVER_INSTANCE.accountSessions.create(
      {
        account: accountId,
        components: {
          account_onboarding: {
            enabled: true,
            features: {
              external_account_collection: true,
            },
          },
        },
      },
    );

    return accountSession.client_secret;
  } catch (error) {
    console.error("Error creating account session:", error);
    throw error;
  }
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
