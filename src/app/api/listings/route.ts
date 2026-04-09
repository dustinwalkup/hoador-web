import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { createListingSchemaServer } from "@/features/listings/form-schema/listing.schema";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
  getClientIP,
  getUserAgent,
} from "@/lib/api/route-helpers";
import { ListingService } from "@/features/listings/services/listing-service";

/**
 * POST /api/listings
 * Create a new listing
 */
async function postHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { userId: currentUserId } = authResult;

    const body = await parseFormData(request);

    const validationResult = createListingSchemaServer.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { listingId } = await ListingService.createListing(
      validationResult.data,
      currentUserId,
      {
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
      },
    );

    return NextResponse.json({
      success: true,
      listingId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(postHandler, "POST /api/listings");
