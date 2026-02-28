import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/db";
import {
  user as userTable,
  account as accountTable,
} from "@/db/schemas/user.schema";
import { communityMemberships } from "@/db/schemas/communities.schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/test/reset-user
 *
 * Test-only route. Returns 404 when E2E_TEST is not set.
 * Resets a user's status and optionally removes community memberships
 * and provider accounts added during test runs.
 *
 * Body (JSON):
 *   email    - user email to reset
 *   status   - status to restore (e.g. "email_verified")
 *   removeCommunity - if true, delete community memberships for this user
 *   removeProvider  - provider id to remove (e.g. "google")
 */
export async function POST(request: NextRequest) {
  if (process.env.E2E_TEST !== "1") {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const { email, status, removeCommunity, removeProvider } = body as {
    email: string;
    status?: string;
    removeCommunity?: boolean;
    removeProvider?: string;
  };

  if (!email) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }

  const [found] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  if (!found) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }

  if (status) {
    await db
      .update(userTable)
      .set({ status: status as (typeof userTable.status.enumValues)[number] })
      .where(eq(userTable.id, found.id));
  }

  if (removeCommunity) {
    await db
      .delete(communityMemberships)
      .where(eq(communityMemberships.userId, found.id));
  }

  if (removeProvider) {
    await db
      .delete(accountTable)
      .where(
        and(
          eq(accountTable.userId, found.id),
          eq(accountTable.providerId, removeProvider),
        ),
      );
  }

  return Response.json({ success: true });
}
