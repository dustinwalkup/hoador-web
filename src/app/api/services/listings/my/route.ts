import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { serviceListingDAL } from "@/dal";

/**
 * GET /api/services/listings/my
 * Returns the signed-in provider's own service listings.
 * Optional ?status=active|inactive|pending_approval|denied
 */
async function getHandler(request: NextRequest) {
  try {
    const authError = await requireAuthResponse();
    if (authError) return authError;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    const { data: allListings, error } = await tryCatch(
      serviceListingDAL.findByProvider(userId),
    );

    if (error) {
      return handleApiError(error);
    }

    const listings = (allListings ?? []).filter((l) =>
      status ? l.status === status : true,
    );

    return NextResponse.json({ listings });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/services/listings/my",
);
