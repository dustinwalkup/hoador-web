import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { user as userTable } from "@/db/schemas/user.schema";
import { communityMemberships } from "@/db/schemas/communities.schema";
import { listingCategories } from "@/db/schemas/listings.schema";
import { neighborhoodNeeds } from "@/db/schemas/neighborhood-needs.schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/test/create-need
 *
 * Test-only route. Returns 404 when E2E_TEST is not set.
 * Seeds a neighborhood need for a specified user. Used by E2E tests
 * that need a need to exist without going through the UI flow.
 *
 * Body (JSON):
 *   email       - email of the user who will own the need
 *   title       - need title
 *   description - need description
 *   type        - "rental" | "service" (default "rental")
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.E2E_TEST !== "1") {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const {
    email,
    title,
    description,
    type = "rental",
  } = body as {
    email: string;
    title: string;
    description: string;
    type?: "rental" | "service";
  };

  if (!email || !title || !description) {
    return Response.json(
      { error: "email, title, and description are required" },
      { status: 400 },
    );
  }

  const [found] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  if (!found) {
    return Response.json({ error: "user not found" }, { status: 404 });
  }

  const [membership] = await db
    .select({ communityId: communityMemberships.communityId })
    .from(communityMemberships)
    .where(eq(communityMemberships.userId, found.id))
    .limit(1);

  if (!membership) {
    return Response.json(
      { error: "user has no community membership" },
      { status: 422 },
    );
  }

  const [category] = await db
    .select({ id: listingCategories.id })
    .from(listingCategories)
    .limit(1);

  if (!category) {
    return Response.json(
      { error: "no listing categories seeded" },
      { status: 422 },
    );
  }

  const [need] = await db
    .insert(neighborhoodNeeds)
    .values({
      createdByUserId: found.id,
      communityId: membership.communityId,
      type,
      categoryId: category.id,
      title,
      description,
      status: "open",
    })
    .returning();

  return Response.json(need, { status: 201 });
}
