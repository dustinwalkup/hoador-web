import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
} from "@/lib/api/route-helpers";
import { ChargebackService } from "@/services/stripe/chargeback-service";

/**
 * POST /api/admin/disputes/[id]/chargeback-evidence
 * Submit evidence to Stripe for a bank-level chargeback (admin only).
 */
async function postHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) return authResult;
    const { userId: adminId, isAdmin } = authResult;

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }

    const { id: disputeId } = await params;

    await ChargebackService.submitEvidence(disputeId, adminId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/admin/disputes/[id]/chargeback-evidence",
);
