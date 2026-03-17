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
 * POST /api/admin/payments/lifecycle/[rentalId]/reset-payout-status
 * Reset payout status from 'processing' or 'failed' to 'pending'. Requires admin.
 * Body: { reason?: string }
 */
async function postHandler(request: NextRequest, context: RouteContext) {
  try {
    const adminCheck = await requireAdminResponse();
    if (adminCheck) return adminCheck;

    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const adminId = authResult.userId;

    const { rentalId } = await context.params;

    let body: { reason?: string } = {};
    try {
      const raw = await request.json();
      if (raw && typeof raw === "object" && "reason" in raw) {
        body = {
          reason: typeof raw.reason === "string" ? raw.reason : undefined,
        };
      }
    } catch {
      // Empty or invalid JSON — optional body, proceed with no reason
    }

    const result = await PaymentLifecycleAdminService.resetPayoutStatus(
      rentalId,
      { reason: body.reason, adminId },
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/payments/lifecycle/[rentalId]/reset-payout-status",
);
