import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  requireAdminResponse,
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { PaymentLifecycleAdminService } from "@/features/admin/services/payment-lifecycle-admin-service";

type RouteContext = { params: Promise<{ rentalId: string }> };

/**
 * POST /api/admin/payments/lifecycle/[rentalId]/release-deposit
 * Manually release deposit hold (cancel PaymentIntent). Requires admin.
 */
async function postHandler(request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const adminId = authResult.userId;

    const { rentalId } = await context.params;

    const result = await PaymentLifecycleAdminService.releaseDeposit(rentalId, {
      adminId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/payments/lifecycle/[rentalId]/release-deposit",
);
