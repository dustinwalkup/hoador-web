import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  requireAuthResponse,
  getClientIP,
  getUserAgent,
  parseFormData,
  getCurrentUserId,
} from "@/lib/api/route-helpers";
import { communityDAL, serviceListingDAL } from "@/dal";
import { createServiceListingSchema } from "@/features/services/lib/service-api-schemas";
import { ServiceListingService } from "@/features/services/services/service-listing-service";

/**
 * GET /api/services/listings
 * Active listings for the current user's community; optional ?categoryId=
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

    const membership = await communityDAL.getMembershipForUser(userId);
    if (!membership) {
      return NextResponse.json(
        { error: "You must belong to a community to browse services" },
        { status: 403 },
      );
    }

    const rawCategory = request.nextUrl.searchParams.get("categoryId");
    let categoryId: string | undefined;
    if (rawCategory) {
      const parsed =
        createServiceListingSchema.shape.categoryId.safeParse(rawCategory);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid categoryId" },
          { status: 400 },
        );
      }
      categoryId = parsed.data;
    }

    const { data, error } = await tryCatch(
      serviceListingDAL.findByCommunityForBrowse(membership.community.id, {
        categoryId,
        excludeProviderId: userId,
      }),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json({ listings: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/services/listings
 * Create a service listing (pending admin approval).
 */
async function postHandler(request: NextRequest) {
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

    const body = await parseFormData(request);
    const parsed = createServiceListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const membership = await communityDAL.getMembershipForUser(userId);
    if (!membership || membership.community.id !== parsed.data.communityId) {
      return NextResponse.json(
        { error: "communityId must match your community membership" },
        { status: 400 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const result = await ServiceListingService.createListing(
      parsed.data,
      userId,
      { ipAddress, userAgent },
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Stripe Connect must be set up before creating a listing",
          code: result.error,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      listingId: result.listing.id,
      status: result.listing.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/services/listings");
export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/listings",
);
