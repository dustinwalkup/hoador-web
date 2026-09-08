import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCatch } from "@walkup/walkup-utils";

import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { quoteServiceBooking } from "@/features/services/services/service-booking-quote";

const previewSchema = z.object({
  listingId: z.string().uuid("Invalid listing ID"),
  proposedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "Invalid date (use YYYY-MM-DD)"),
  hours: z.number().positive().optional().nullable(),
});

/** Money leaves this route as decimal STRINGS, as it does everywhere else. */
const money = (value: number) => value.toFixed(2);

/**
 * POST /api/services/bookings/preview
 *
 * Price a prospective service booking **without creating anything** (mobile
 * prerequisite P-E9-1, decision D-E9-1).
 *
 * ## Why this exists
 *
 * The itemized summary Req 11.1.2 asks for — service subtotal, service fee,
 * total — had no HTTP surface, so the web flow computes all of it **in the
 * browser** (`service-booking-flow.tsx`). Unlike rentals there was not even a
 * server-side pricing module to be a second implementation *of*: the arithmetic
 * existed only inside `createBooking`, a mutation, where no read could reach it.
 * A mobile binary that cannot be hot-fixed would have been the third copy.
 *
 * So this route computes nothing itself. It calls `quoteServiceBooking` — the
 * same function `ServiceBookingService.createBooking` calls — and serializes the
 * result. The quote and the charge run one code path by construction, not by a
 * test that keeps them in step.
 *
 * ## Blockers are a 200, not a 400
 *
 * Own-listing, missing hours and a past date all come back as `canBook: false`
 * with a `blockers` array carrying stable codes, and **all of them at once** —
 * a stepper that fixes one problem only to be told the next is the experience
 * this avoids. The client can only explain what it was told, and a 400 would
 * collapse three distinguishable answers into "something went wrong".
 *
 * The quote is still priced for an unbookable input, so the screen can show
 * what it *would* have cost beside the reason it cannot.
 *
 * A missing or inactive listing is still a 404: there is nothing to explain
 * about it, and that is what `createBooking` has always answered.
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
      quoteServiceBooking(parsed.data, userId),
    );
    if (error) return handleApiError(error);
    if (!quote) {
      return NextResponse.json(
        { error: "Could not price this booking" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      listingId: quote.listingId,
      listingTitle: quote.listingTitle,
      pricingType: quote.pricingType,
      /** The provider's rate — per hour when hourly, else the flat price. */
      rate: money(quote.rate),
      hours: quote.hours,

      // The itemization of Req 11.1.2, in the order it is read.
      servicePrice: money(quote.servicePrice),
      serviceFee: money(quote.serviceFee),
      totalAmount: money(quote.totalAmount),
      /**
       * Nothing is charged at submit — the charge happens when the provider
       * accepts (Req 11.1.2). Shipped as a flag beside the total so no client
       * has to remember which way round this lifecycle works.
       */
      chargedOnAcceptance: quote.chargedOnAcceptance,

      canBook: quote.canBook,
      blockers: quote.blockers,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/services/bookings/preview",
);
