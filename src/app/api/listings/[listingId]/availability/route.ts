import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";

import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { listingDAL, rentalDAL } from "@/dal";
import { ConflictError, ForbiddenError, NotFoundError } from "@/dal/errors";
import { db } from "@/db/db";
import { listingAvailability } from "@/db/schemas/listings.schema";
import { toBookedRanges } from "@/features/rentals/lib/availability";

/**
 * Block a range of days on a listing's calendar.
 *
 * **This surface did not exist.** `listing_availability` has been readable since
 * the schema was written — the rows ship on the listing detail and merge into
 * `bookedRanges`, and `createRentalRequest` enforces them — but nothing in
 * either repo has ever INSERTED or DELETED one. Mobile Req 7.4 ("block/unblock
 * date ranges") had no backend at all, and the requirement's "consistent with
 * the web listing form's availability capability" describes a capability the web
 * form does not have.
 *
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-10-manage-listings-ai.md
 *       § F9 / P-E10-3
 */

/**
 * Days, not instants. `start_date`/`end_date` are `timestamp` columns fed from a
 * day picker, and accepting an ISO instant here would let a client's zone decide
 * which day got blocked — the R-8.7 family, which has now surfaced five times in
 * this codebase and which decides real availability here.
 *
 * The strings are parsed as **UTC midnight** on the way in and serialized back
 * through `toWallClock` on the way out, so the value round-trips as the same
 * calendar day regardless of where the server or the client is standing.
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/u;

const blockRangeSchema = z
  .object({
    from: z.string().regex(DAY, "Use YYYY-MM-DD"),
    to: z.string().regex(DAY, "Use YYYY-MM-DD"),
    reason: z.string().trim().max(255).optional(),
  })
  .refine((data) => data.to >= data.from, {
    message: "The end date can't be before the start date",
    path: ["to"],
  });

/** `YYYY-MM-DD` → the Date the timestamp column should hold for that day. */
function toDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { listingId } = await params;
    if (!listingId) {
      return NextResponse.json(
        { error: "Listing ID is required" },
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

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const parsed = blockRangeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { from, to, reason } = parsed.data;

    // A range covering days a renter has already booked cannot be blocked: the
    // rental is committed and the owner owes the item. Comparison is on day
    // KEYS, never on instants — the rule the rest of this codebase follows
    // (design D19), and inclusive at both ends because an item is still out on
    // its return day.
    const existing = await rentalDAL.getBookedDatesForListing(listingId);
    const conflict = toBookedRanges(existing).find(
      (range) =>
        range.source === "rental" && range.from <= to && range.to >= from,
    );
    if (conflict) {
      return handleApiError(
        new ConflictError(
          `Those dates overlap a booking from ${conflict.from} to ${conflict.to}. You can't block days that are already rented.`,
        ),
      );
    }

    const { data: inserted, error } = await tryCatch(
      db
        .insert(listingAvailability)
        .values({
          listingId,
          startDate: toDayStart(from),
          endDate: toDayStart(to),
          isBlocked: true,
          reason: reason || null,
        })
        .returning({ id: listingAvailability.id }),
    );
    if (error) return handleApiError(error);

    // Overlapping BLOCKS are deliberately allowed: two blocks covering the same
    // day is not a contradiction, and refusing it would make an owner delete
    // before extending. `bookedRanges` merges them for display anyway.
    return NextResponse.json({
      success: true,
      block: { id: inserted?.[0]?.id, from, to, reason: reason || null },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/listings/[listingId]/availability",
);
