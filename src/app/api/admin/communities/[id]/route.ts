import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { communityDAL } from "@/dal";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  parseFormData,
  handleApiError,
} from "@/lib/api/route-helpers";
import type { UpdateCommunity } from "@/db/schemas/communities.schema";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/communities/[id]
 * Update a community. Whitelisted fields: name, imageUrl, address, city,
 * state, zip, latitude, longitude, isActive, networkId.
 * Requires admin authentication.
 */
async function patchHandler(request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;
    const body = (await parseFormData(request)) as Record<string, unknown>;

    const update: UpdateCommunity = {};
    if (typeof body.name === "string") update.name = body.name;
    if (typeof body.imageUrl === "string" || body.imageUrl === null)
      update.imageUrl = body.imageUrl as string | null;
    if (typeof body.address === "string" || body.address === null)
      update.address = body.address as string | null;
    if (typeof body.city === "string" || body.city === null)
      update.city = body.city as string | null;
    if (typeof body.state === "string" || body.state === null)
      update.state = body.state as string | null;
    if (typeof body.zip === "string" || body.zip === null)
      update.zip = body.zip as string | null;
    if (typeof body.latitude === "string" || body.latitude === null)
      update.latitude = body.latitude as string | null;
    if (typeof body.longitude === "string" || body.longitude === null)
      update.longitude = body.longitude as string | null;
    if (typeof body.isActive === "boolean") update.isActive = body.isActive;
    if (typeof body.networkId === "string" || body.networkId === null)
      update.networkId = body.networkId as string | null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 },
      );
    }

    const community = await communityDAL.updateCommunity(id, update);
    return NextResponse.json(community);
  } catch (error) {
    return handleApiError(error);
  }
}
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/admin/communities/[id]",
);
