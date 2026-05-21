import { test, expect, type APIRequestContext } from "@playwright/test";

import { E2E_PASSWORD, E2E_USER_ACTIVE } from "../auth/constants";
import { login } from "../auth/helpers";

/**
 * Epic 9 — Stripe Connect gating, JIT acceptance UX.
 *
 * Scope: focused JIT-redirect tests against the
 * `/dashboard/payments/earnings-and-payouts?returnTo=...` endpoint.
 *
 * What is covered here (and verifiable end-to-end without Stripe):
 *   - Entry to JIT mode when the owner is not payout-verified.
 *   - Server-side auto-redirect back to `returnTo` once the user is verified
 *     (the 9.1 "round-trip" pivot point — Stripe iframe completion itself is
 *     simulated via the test-only `/api/test/set-stripe-connect-state` route).
 *   - Capability regression: a verified user whose payouts are disabled
 *     re-enters JIT mode rather than being redirected out (9.2).
 *
 * Not covered here:
 *   - Driving the actual Stripe Connect Embedded Components iframe to enter
 *     SSN/bank. Stripe's hosted UI cannot be reliably automated in Playwright.
 *   - The `Accept` click on a real pending booking. There are no rental
 *     fixtures in the E2E seed; the 403→redirect contract is covered by
 *     route-level integration tests under `src/app/api/rentals/[id]/approve`
 *     and `src/app/api/services/bookings/[id]/accept`.
 */

const RETURN_TO_PATH = "/dashboard/rentals";
const JIT_URL = `/dashboard/payments/earnings-and-payouts?returnTo=${encodeURIComponent(
  RETURN_TO_PATH,
)}`;
const EARNINGS_TABS_LABEL = /Payment methods/i;

type ConnectState = {
  stripeConnectedAccountId?: string | null;
  connectChargesEnabled?: boolean;
  connectPayoutsEnabled?: boolean;
  connectOnboardingComplete?: boolean;
};

async function setConnectState(
  request: APIRequestContext,
  email: string,
  state: ConnectState,
): Promise<void> {
  const response = await request.post("/api/test/set-stripe-connect-state", {
    data: { email, ...state },
  });
  if (!response.ok()) {
    throw new Error(
      `set-stripe-connect-state failed: ${response.status()} ${await response.text()}`,
    );
  }
}

async function clearConnectState(
  request: APIRequestContext,
  email: string,
): Promise<void> {
  await setConnectState(request, email, {
    stripeConnectedAccountId: null,
    connectChargesEnabled: false,
    connectPayoutsEnabled: false,
    connectOnboardingComplete: false,
  });
}

test.describe("Stripe Connect gating — JIT mode", () => {
  test.beforeEach(async ({ request }) => {
    await clearConnectState(request, E2E_USER_ACTIVE);
  });

  test.afterEach(async ({ request }) => {
    await clearConnectState(request, E2E_USER_ACTIVE);
  });

  /**
   * 9.1 — Happy-path JIT round-trip pivot.
   *
   * The user lands on the JIT URL while their cached Connect state is
   * `not_started`; the page must render the focused JIT view (no PaymentsTabs).
   * We then simulate completion of Stripe Connect via the test endpoint and
   * reload — the server must `redirect()` straight back to `returnTo`.
   */
  test("redirects a verified user back to returnTo; renders JIT view when not verified", async ({
    page,
    request,
  }) => {
    await login(page, E2E_USER_ACTIVE, E2E_PASSWORD);

    // not_started → JIT view rendered, no PaymentsTabs.
    await page.goto(JIT_URL);
    await expect(page).toHaveURL(/earnings-and-payouts\?returnTo=/);
    await expect(page.getByText(EARNINGS_TABS_LABEL)).toBeHidden();

    // Simulate Stripe completion — webhook would do this in production.
    await setConnectState(request, E2E_USER_ACTIVE, {
      connectChargesEnabled: true,
      connectPayoutsEnabled: true,
      connectOnboardingComplete: true,
    });

    // verified + returnTo → server-side redirect.
    await page.goto(JIT_URL);
    await expect(page).toHaveURL(new RegExp(`${RETURN_TO_PATH}$`));
  });

  /**
   * 9.2 — Capability-regression path.
   *
   * Start the user verified, confirm the JIT URL bounces them out, then flip
   * `connectPayoutsEnabled = false`. The user is now `restricted`: the JIT URL
   * must render the JIT view (no auto-redirect) so the renewal flow can run.
   */
  test("a previously-verified user whose payouts are disabled re-enters JIT mode", async ({
    page,
    request,
  }) => {
    await setConnectState(request, E2E_USER_ACTIVE, {
      connectChargesEnabled: true,
      connectPayoutsEnabled: true,
      connectOnboardingComplete: true,
    });
    await login(page, E2E_USER_ACTIVE, E2E_PASSWORD);

    // verified → bounce out of JIT.
    await page.goto(JIT_URL);
    await expect(page).toHaveURL(new RegExp(`${RETURN_TO_PATH}$`));

    // Regress: payouts disabled but onboardingComplete stays true → restricted.
    await setConnectState(request, E2E_USER_ACTIVE, {
      connectChargesEnabled: true,
      connectPayoutsEnabled: false,
      connectOnboardingComplete: true,
    });

    // restricted + returnTo → JIT view rendered, no PaymentsTabs.
    await page.goto(JIT_URL);
    await expect(page).toHaveURL(/earnings-and-payouts\?returnTo=/);
    await expect(page.getByText(EARNINGS_TABS_LABEL)).toBeHidden();
  });
});
