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
import { patchServiceListingSchema } from "@/features/services/lib/service-api-schemas";
import { ServiceListingService } from "@/features/services/services/service-listing-service";

/**
 * GET /api/services/listings/[id]
 * Listing detail (same community or listing provider).
 */
async function getHandler(
  _request: NextRequest,
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

    const { data: listing, error } = await tryCatch(
      serviceListingDAL.getById(id),
    );

    if (error) {
      return handleApiError(error);
    }

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const membership = await communityDAL.getMembershipForUser(userId);
    if (!membership) {
      return NextResponse.json(
        { error: "You must belong to a community to view listings" },
        { status: 403 },
      );
    }

    const sameCommunity = listing.communityId === membership.community.id;
    const isProvider = listing.providerId === userId;
    if (!sameCommunity && !isProvider) {
      return NextResponse.json(
        { error: "You cannot view this listing" },
        { status: 403 },
      );
    }

    return NextResponse.json(listing);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/services/listings/[id]
 * Provider updates their listing.
 */
async function patchHandler(
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
    const body = await parseFormData(request);
    const parsed = patchServiceListingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    const d = parsed.data;
    const updates = {
      ...d,
      ...(d.price !== undefined ? { price: String(d.price) } : {}),
    } as Parameters<typeof ServiceListingService.editListing>[2];

    const { data, error } = await tryCatch(
      ServiceListingService.editListing(id, userId, updates, {
        ipAddress,
        userAgent,
      }),
    );

    if (error) {
      return handleApiError(error);
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/services/listings/[id]",
);
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/services/listings/[id]",
);
