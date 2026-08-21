import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { paymentDAL } from "@/dal";

/**
 * Owner earnings feed
 * GET /api/payouts/earnings?page=1&limit=20
 *
 * Per completed rental or service booking the caller was paid for: gross, the
 * platform fee, the net payout, the transfer state, and — while a payout is
 * frozen — the dispute holding it up.
 *
 * Built for the mobile earnings screen; no web caller today.
 *
 * Requirements: 13.3.1, 13.3.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md
 *       § P-E7-1 (D-E7-9, D-P1…D-P8)
 *
 * Additive and read-only: nothing else reads or writes through this path.
 *
 * No `safe()` wrapper here, unlike `/api/dashboard/summary`: that route composes
 * four independent sources and degrades each one separately. This is a single
 * query — there is no partial answer to preserve, and swallowing its failure
 * would render an empty earnings list to an owner who has been paid, which is
 * worse than an error state.
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

    const result = await paymentDAL.getUserEarnings(userId, parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(getHandler, "GET /api/payouts/earnings");
