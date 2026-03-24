import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { ServiceListingService } from "@/features/services/services/service-listing-service";

/**
 * POST /api/services/listings/[id]/reactivate
 * Provider reactivates a previously deactivated listing.
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const { error } = await tryCatch(
      ServiceListingService.reactivateListing(id, userId, {
        ipAddress,
        userAgent,
      }),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ status: "active" as const });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/listings/[id]/reactivate",
);
