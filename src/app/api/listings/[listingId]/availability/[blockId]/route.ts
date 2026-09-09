import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { tryCatch } from "@walkup/walkup-utils";

import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { listingDAL } from "@/dal";
import { ForbiddenError, NotFoundError } from "@/dal/errors";
import { db } from "@/db/db";
import { listingAvailability } from "@/db/schemas/listings.schema";

/**
 * Lift an owner's manual block (mobile Req 7.4.1, P-E10-3).
 *
 * Only rows the owner created can be removed — a rental occupying the calendar
 * is not represented here at all, so there is no way to "unblock" someone else's
 * booking by mistake.
 */
async function deleteHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string; blockId: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { listingId, blockId } = await params;
    if (!listingId || !blockId) {
      return NextResponse.json(
        { error: "Listing ID and block ID are required" },
        { status: 400 },
      );
    }

    const listing = await listingDAL.getListingById(listingId);
    if (!listing)
      return handleApiError(new NotFoundError("listing", listingId));
    if (listing.owner.id !== userId) {
      return handleApiError(
        new ForbiddenError("You can only manage your own listings"),
      );
    }

    // Scoped to BOTH ids: ownership is checked on the listing above, but without
    // the listing predicate a caller could delete a block belonging to a listing
    // they don't own by passing a foreign block id — the F32 shape, one table over.
    const { data: deleted, error } = await tryCatch(
      db
        .delete(listingAvailability)
        .where(
          and(
            eq(listingAvailability.id, blockId),
            eq(listingAvailability.listingId, listingId),
          ),
        )
        .returning({ id: listingAvailability.id }),
    );
    if (error) return handleApiError(error);

    if (!deleted || deleted.length === 0) {
      return handleApiError(new NotFoundError("availability block", blockId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/listings/[listingId]/availability/[blockId]",
);
