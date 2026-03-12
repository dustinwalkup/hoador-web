import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";
import {
  createListingSchemaServer,
  type CreateListingFormDataServerType,
} from "@/features/listings/form-schema/listing.schema";
import { ListingService } from "@/features/listings/services/listing-service";

/**
 * Simple in-memory rate limiter for image uploads.
 * For multi-instance deployments, replace with Redis-based rate limiting (e.g., @upstash/ratelimit).
 */
const uploadTimestamps = new Map<string, number[]>();
const MAX_UPLOADS_PER_MINUTE = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkUploadRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = uploadTimestamps.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_UPLOADS_PER_MINUTE) {
    uploadTimestamps.set(userId, recent);
    return false;
  }
  recent.push(now);
  uploadTimestamps.set(userId, recent);
  return true;
}

/**
 * POST /api/listings/[listingId]
 * Upload a listing image
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    if (!checkUploadRateLimit(userId)) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    const { listingId } = await params;
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "listing ID is required" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const { data: result, error } = await tryCatch(
      ListingService.uploadListingImage({ listingId, file }, userId),
    );
    if (error) return handleApiError(error);

    return NextResponse.json({ success: true, image: result.image });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/listings/[listingId]",
);

/**
 * PATCH /api/listings/[listingId]
 * Update a listing
 */
async function patchHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId: currentUserId } = authResult;

    const { listingId } = await params;
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 },
      );
    }

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

    const validatedData =
      validationResult.data as CreateListingFormDataServerType;

    const { data: result, error } = await tryCatch(
      ListingService.updateListing(listingId, validatedData, currentUserId),
    );
    if (error) return handleApiError(error);

    return NextResponse.json({
      success: true,
      listingId: result.listingId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
export const PATCH = withRequestLogging(
  patchHandler,
  "PATCH /api/listings/[listingId]",
);

/**
 * DELETE /api/listings/[listingId]
 * Delete a listing
 */
async function deleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const { listingId } = await params;
    if (!listingId || listingId === "") {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 },
      );
    }

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { error } = await tryCatch(
      ListingService.deleteListing(listingId, userId),
    );
    if (error) return handleApiError(error);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/listings/[listingId]",
);
