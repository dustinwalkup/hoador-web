import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { paymentDAL } from "@/dal";

/**
 * Renter/requester payment history
 * GET /api/payments/history?page=1&limit=20
 *
 * Every charge the caller paid — across **both** rentals and service bookings —
 * with refunds and, for rentals, the deposit-hold state.
 *
 * Built for the mobile payment-history screen; no web caller today. The web's
 * own history is rental-only (`getUserRentalPayments` inner-joins `rentals`),
 * which silently drops service-booking charges; this route closes that gap.
 *
 * Requirements: 12.2.1, 12.2.2, 14.1.4, 14.1.5
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md
 *       § P-E7-2 (D-E7-10, D-P2, D-P3, D-P6)
 *
 * Additive and read-only: nothing else reads or writes through this path.
 *
 * No `safe()` wrapper, for the same reason as the earnings route: one query, no
 * partial answer worth preserving, and an empty list shown to someone who was
 * charged is worse than an error state.
 */
const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // Capped here as well as in `validatePagination`, so an over-large value is a
  // 400 with a readable message rather than a DAL ValidationError.
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

async function getHandler(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // 401
    }
    const { userId } = authResult;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 },
      );
    }

    const result = await paymentDAL.getUserPaymentHistory(userId, parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/payments/history");
