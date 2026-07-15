import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { neighborhoodNeeds } from "@/db/schemas/neighborhood-needs.schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/test/delete-need
 *
 * Test-only route. Returns 404 when E2E_TEST is not set.
 * Hard-deletes all neighborhood needs whose title matches exactly.
 * Used by E2E tests to clean up needs they created during the test run.
 *
 * Body (JSON):
 *   title - exact title of the need(s) to delete
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.E2E_TEST !== "1") {
    return new Response(null, { status: 404 });
  }

  const body = await request.json();
  const { title } = body as { title?: string };

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  await db.delete(neighborhoodNeeds).where(eq(neighborhoodNeeds.title, title));

  return Response.json({ success: true });
}
