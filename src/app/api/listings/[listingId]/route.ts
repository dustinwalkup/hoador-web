import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { tryCatch } from "@walkup/walkup-utils";
import {
  handleApiError,
  parseFormData,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";
import { communityDAL, listingDAL } from "@/dal";
import { NotFoundError } from "@/dal/errors";
import {
  createListingSchemaServer,
  type CreateListingFormDataServerType,
} from "@/features/listings/form-schema/listing.schema";
import { ListingService } from "@/features/listings/services/listing-service";

// TODO: Add distributed rate limiting for image uploads (e.g., @upstash/ratelimit with Redis).
// An in-memory limiter is ineffective on serverless (Vercel) deployments.

/**
 * Statuses a non-owner may view, mirroring the web detail page
 * (`src/app/dashboard/listings/[id]/page.tsx`).
 */
const BROWSEABLE_STATUSES = new Set(["available", "rented"]);

/**
 * GET /api/listings/[listingId]
 * Rental listing detail (mobile prerequisite P-E6-1).
 *
 * The web detail page is a server component reading `listingDAL.getListingById`
 * directly, so this data had no HTTP surface at all. The authz below is a
 * deliberate mirror of that page — same three gates, same NOT-FOUND outcome:
 *
 *  1. the owner may always view their own listing;
 *  2. otherwise the status must be browseable (`available`/`rented`);
 *  3. and BOTH parties must be visible in the listing's community (the
 *     symmetric R5 rule the search query also applies).
 *
 * Failures return **404, never 403** — matching the page's `notFound()`. A 403
 * would confirm that a listing exists at an id the caller may not see.
 *
 * `approvalStatus`/`rejectionReason` are stripped for non-owners: the app must
 * never display another owner's moderation state (mobile Req 6.1.3), and the
 * surest way is to not send it. Owners keep both — the garage needs them.
 *
 * Note `getListingById` increments `viewCount` when passed a viewer id; that is
 * the web page's behaviour too, and the mobile detail screen wants the same.
 */
async function getHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { listingId } = await params;
    if (!listingId) {
      return NextResponse.json(
        { error: "listing ID is required" },
        { status: 400 },
      );
    }

    const { data: listing, error } = await tryCatch(
      listingDAL.getListingById(listingId, userId),
    );
    if (error) return handleApiError(error);
    if (!listing)
      return handleApiError(new NotFoundError("listing", listingId));

    const isOwner = listing.owner.id === userId;

    if (!isOwner) {
      if (!BROWSEABLE_STATUSES.has(listing.status)) {
        return handleApiError(new NotFoundError("listing", listingId));
      }

      const [viewerVisible, ownerVisible] = await Promise.all([
        communityDAL.isVisibleInCommunity(userId, listing.communityId),
        communityDAL.isVisibleInCommunity(
          listing.owner.id,
          listing.communityId,
        ),
      ]);
      if (!viewerVisible || !ownerVisible) {
        return handleApiError(new NotFoundError("listing", listingId));
      }

      const { approvalStatus, rejectionReason, ...visibleToRenter } = listing;
      void approvalStatus;
      void rejectionReason;
      return NextResponse.json({ ...visibleToRenter, isOwner });
    }

    return NextResponse.json({ ...listing, isOwner });
  } catch (error) {
    return handleApiError(error);
  }
}
export const GET = withRequestLogging(
  getHandler,
  "GET /api/listings/[listingId]",
);

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
