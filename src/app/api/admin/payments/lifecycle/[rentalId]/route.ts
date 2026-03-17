import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { requireAdminResponse, handleApiError } from "@/lib/api/route-helpers";
import { PaymentLifecycleAdminService } from "@/features/admin/services/payment-lifecycle-admin-service";

type RouteContext = { params: Promise<{ rentalId: string }> };

/**
 * GET /api/admin/payments/lifecycle/[rentalId]
 * Full payment lifecycle detail for a rental. Requires admin.
 * Returns 404 if not found.
 */
async function getHandler(_request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const { rentalId } = await context.params;
    const result =
      await PaymentLifecycleAdminService.getLifecycleDetail(rentalId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/admin/payments/lifecycle/[rentalId]",
);
