import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";

import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { quoteRentalRequest } from "@/features/rentals/services/rental-quote";

const previewSchema = z.object({
  listingId: z.string().uuid("Invalid listing ID"),
  startDate: z.coerce.date({ message: "Start date is required" }),
  endDate: z.coerce.date({ message: "End date is required" }),
  deliveryRequested: z.boolean().optional(),
  setupRequested: z.boolean().optional(),
  setupFee: z.number().optional(),
});

/** Money leaves this route as decimal STRINGS, as it does everywhere else. */
const money = (value: number) => value.toFixed(2);

/**
 * POST /api/rentals/preview
 *
 * Price a prospective rental **without creating anything** (mobile prerequisite
 * P-E8A-1, decision D-E8A-1).
 *
 * ## Why this exists
 *
 * The itemized summary Req 9.1.3 asks for — subtotal, delivery, setup, service
 * fee, total due, deposit as a hold — had no HTTP surface, so the web checkout
 * computes all of it **in the browser**
 * (`rent-flow/rent-listing-page-content.tsx`), which is already a second
 * implementation of the maths in `lib/pricing.ts`. A mobile binary that cannot
 * be hot-fixed would have been a third, and a quoted total that differs from the
 * charged total is the most damaging bug this flow has.
 *
 * So this route computes nothing itself. It calls `quoteRentalRequest` — the
 * same function `RentalService.createRentalRequest` calls — and serializes the
 * result. The quote and the charge run one code path by construction, not by
 * a test that keeps them in step.
 *
 * ## Blockers are a 200, not a 400
 *
 * An own-listing, an out-of-range period or a date clash all come back as
 * `canBook: false` with a `blockers` array carrying stable codes. Req 9.1.6 asks
 * for the own-listing case to be an *explanation* rather than a disabled button,
 * and the client can only explain what it was told. A 400 would collapse six
 * distinguishable answers into "something went wrong".
 *
 * A missing listing is still a 404: there is nothing to explain about it.
 */
async function postHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await parseFormData(request);
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { data: quote, error } = await tryCatch(
      quoteRentalRequest(parsed.data, userId),
    );
    if (error) return handleApiError(error);
    if (!quote) {
      return NextResponse.json(
        { error: "Could not price this rental" },
        { status: 500 },
      );
    }

    const { pricing } = quote;

    return NextResponse.json({
      listingId: quote.listingId,
      listingName: quote.listingName,
      totalDays: quote.totalDays,

      // The itemization of Req 9.1.3, in the order it is read.
      dailyRate: money(pricing.dailyRate),
      subtotal: money(pricing.subtotal),
      deliveryFee: money(pricing.deliveryFee),
      setupFee: money(pricing.setupFee),
      serviceFee: money(pricing.serviceFee),
      /** Charged only when the owner approves — never at submit (Req 9.1.5). */
      totalAmount: money(pricing.totalAmount),
      /**
       * A **hold**, never a charge (Req 14.1.1). The flag ships beside the
       * amount so no client has to remember which of the two this is.
       */
      securityDeposit: money(pricing.securityDeposit),
      securityDepositIsHold: quote.securityDepositIsHold,

      canBook: quote.canBook,
      blockers: quote.blockers,
      bookedRanges: quote.bookedRanges,
      minimumRentalPeriod: quote.minimumRentalPeriod,
      maximumRentalPeriod: quote.maximumRentalPeriod,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/rentals/preview",
);
