import { NextRequest } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  handleApiError,
  getAuthenticatedUserResponse,
} from "@/lib/api/route-helpers";
import { PaymentLifecycleService } from "@/features/rentals/services/payment-lifecycle-service";

/**
 * POST /api/rentals/[id]/retry-deposit
 * Retry a failed deposit hold for a rental (renter only)
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const { id } = await params;

    const result = await PaymentLifecycleService.retryDepositHold(id, userId);

    if (result.success) {
      return Response.json({ success: true });
    }

    return Response.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/rentals/[id]/retry-deposit",
);
