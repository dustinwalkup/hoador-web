import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  captureNonCriticalError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { disputeDAL } from "@/dal";
import { DisputeStateMachine } from "@/features/disputes/lib/state-machine";
import { z } from "zod";
import type { DisputeStatus } from "@/dal/types";
import { sendDisputeNotifications } from "@/features/disputes/notifications/dispute-notifications";

/**
 * PATCH /api/disputes/[id]/state
 * Update dispute state (admin only for most transitions)
 */
const updateStateSchema = z.object({
  newState: z.enum([
    "open",
    "evidence_requested",
    "under_review",
    "resolved",
    "closed",
  ]),
  reason: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId, isAdmin } = authResult;

    const { id } = await params;

    // Parse and validate request body
    const body = await parseFormData(request);
    const validationResult = updateStateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { newState, reason } = validationResult.data;

    // Get dispute
    const dispute = await disputeDAL.getById(id);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Validate transition
    const validation = DisputeStateMachine.validateTransition(
      dispute.status,
      newState as DisputeStatus,
      isAdmin,
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid state transition" },
        { status: 400 },
      );
    }

    // Store previous state for audit log
    const previousState = dispute.status;

    // Update state
    const updatedDispute = await disputeDAL.updateState(
      id,
      newState as DisputeStatus,
      userId,
      reason || undefined,
    );

    // Create audit log for state change
    await disputeDAL.createAuditLog({
      disputeId: id,
      actionType: "state_change",
      userId,
      previousState,
      newState: newState as DisputeStatus,
      reason: reason || undefined,
    });

    // Send notifications if transitioning to evidence_requested
    if (newState === "evidence_requested") {
      try {
        // Get full dispute with relations for notifications
        const disputeWithRelations = await disputeDAL.getById(id);
        if (disputeWithRelations) {
          await sendDisputeNotifications(
            disputeWithRelations,
            "evidence_requested",
          );
        }
      } catch (notificationError) {
        captureNonCriticalError(notificationError, {
          route: "PATCH /api/disputes/[id]/state",
          action: "send_evidence_requested_notifications",
        });
      }
    }

    return NextResponse.json(updatedDispute);
  } catch (error) {
    return handleApiError(error);
  }
}
