import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { z } from "zod";
import type { DisputeResolutionOutcome } from "@/dal/types";
import { DisputeResolutionService } from "@/features/disputes/services/dispute-resolution-service";

/**
 * POST /api/disputes/[id]/resolve
 * Resolve a dispute (admin only).
 * Thin handler: auth + Zod parse + delegate to DisputeResolutionService.
 */
const resolveDisputeSchema = z.object({
  outcome: z.enum([
    "favor_renter",
    "favor_provider",
    "partial_renter",
    "partial_provider",
    "dismissed",
  ]),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  partialAmount: z.number().positive().optional(),
});

async function postHandler(
  request: NextRequest,
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

    const body = await parseFormData(request);
    const validationResult = resolveDisputeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { outcome, reason, partialAmount } = validationResult.data;

    const result = await DisputeResolutionService.resolveDispute({
      disputeId,
      outcome: outcome as DisputeResolutionOutcome,
      reason,
      adminId,
      partialAmount,
    });

    return NextResponse.json({
      ...result.dispute,
      depositOperationStatus: result.depositOperationStatus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRequestLogging(
  postHandler,
  "POST /api/disputes/[id]/resolve",
);
