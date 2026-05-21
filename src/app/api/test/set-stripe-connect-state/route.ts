import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { user as userTable } from "@/db/schemas/user.schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/test/set-stripe-connect-state
 *
 * Test-only route. Returns 404 outside of E2E mode.
 *
 * Mutates a user's Stripe Connect cached flags so Playwright can drive the
 * gating behavior without hitting Stripe. Mirrors what the
 * `account.updated` webhook would normally do.
 *
 * Body (JSON):
 *   email                       - user email to mutate (required)
 *   stripeConnectedAccountId    - string | null   (defaults to "acct_e2e_test" when any flag is true)
 *   connectChargesEnabled       - boolean         (default false)
 *   connectPayoutsEnabled       - boolean         (default false)
 *   connectOnboardingComplete   - boolean         (default false)
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.E2E_TEST !== "1") {
    return new Response(null, { status: 404 });
  }

  const body = (await request.json()) as {
    email?: string;
    stripeConnectedAccountId?: string | null;
    connectChargesEnabled?: boolean;
    connectPayoutsEnabled?: boolean;
    connectOnboardingComplete?: boolean;
  };

  if (!body.email) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }

  const chargesEnabled = body.connectChargesEnabled ?? false;
  const payoutsEnabled = body.connectPayoutsEnabled ?? false;
  const onboardingComplete = body.connectOnboardingComplete ?? false;
  const anyFlagSet = chargesEnabled || payoutsEnabled || onboardingComplete;
  const stripeAccountId =
    body.stripeConnectedAccountId === undefined
      ? anyFlagSet
        ? "acct_e2e_test"
        : null
      : body.stripeConnectedAccountId;

  const [found] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, body.email))
    .limit(1);

  if (!found) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }

  await db
    .update(userTable)
    .set({
      stripeConnectedAccountId: stripeAccountId,
      connectChargesEnabled: chargesEnabled,
      connectPayoutsEnabled: payoutsEnabled,
      connectOnboardingComplete: onboardingComplete,
    })
    .where(eq(userTable.id, found.id));

  return Response.json({ success: true });
}
