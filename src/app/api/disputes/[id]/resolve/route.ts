import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  captureNonCriticalError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { disputeDAL, auditLogDAL } from "@/dal";
import { StripeDisputeService } from "@/services/stripe/dispute-financial";
import { z } from "zod";
import type {
  DisputeResolutionOutcome,
  FinancialOperationType,
} from "@/dal/types";
import { sendDisputeNotifications } from "@/features/disputes/notifications/dispute-notifications";

/**
 * POST /api/disputes/[id]/resolve
 * Resolve a dispute (admin only)
 * Executes financial operations and marks dispute as resolved
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
  financialOperations: z
    .array(
      z.object({
        type: z.enum([
          "hold_payout",
          "refund_partial",
          "refund_full",
          "capture_deposit",
        ]),
        amount: z.number().optional(),
      }),
    )
    .optional(),
});

async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate and check admin
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId: resolvedBy, isAdmin } = authResult;

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }

    const { id: disputeId } = await params;

    // Parse and validate request body
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

    const { outcome, reason, financialOperations } = validationResult.data;

    // Get dispute
    const dispute = await disputeDAL.getById(disputeId);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Verify dispute can be resolved (not already resolved or closed)
    if (dispute.status === "resolved" || dispute.status === "closed") {
      return NextResponse.json(
        {
          error: `Dispute is already ${dispute.status} and cannot be resolved again`,
        },
        { status: 400 },
      );
    }

    // Execute financial operations if provided
    if (financialOperations && financialOperations.length > 0) {
      for (const operation of financialOperations) {
        try {
          await StripeDisputeService.executeOperation(
            dispute,
            {
              type: operation.type as FinancialOperationType,
              amount: operation.amount,
            },
            resolvedBy,
          );
        } catch (error) {
          // Log error but continue with resolution
          console.error(
            `Failed to execute financial operation ${operation.type}:`,
            error,
          );
          // Return error if financial operation fails
          return NextResponse.json(
            {
              error: `Failed to execute financial operation: ${operation.type}`,
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          );
        }
      }
    }

    // Resolve dispute
    const resolvedDispute = await disputeDAL.resolve(
      disputeId,
      outcome as DisputeResolutionOutcome,
      reason,
      resolvedBy,
    );

    // Create audit log for resolution
    await disputeDAL.createAuditLog({
      disputeId,
      actionType: "resolution",
      userId: resolvedBy,
      previousState: dispute.status,
      newState: "resolved",
      details: {
        outcome,
        financialOperations: financialOperations?.map((op) => op.type),
      },
      reason,
    });

    await auditLogDAL.create({
      entityType: "dispute",
      entityId: disputeId,
      action: "dispute.resolved",
      userId: resolvedBy,
      metadata: {
        previousStatus: dispute.status,
        newStatus: "resolved",
        resolutionOutcome: outcome,
      },
    });

    // Send notifications (don't block on notification failure)
    try {
      // Get full dispute with relations for notifications
      const disputeWithRelations = await disputeDAL.getById(disputeId);
      if (disputeWithRelations) {
        await sendDisputeNotifications(disputeWithRelations, "resolved");
      }
    } catch (notificationError) {
      captureNonCriticalError(notificationError, {
        route: "POST /api/disputes/[id]/resolve",
        action: "send_dispute_resolved_notifications",
      });
    }

    return NextResponse.json(resolvedDispute);
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/disputes/[id]/resolve",
);
