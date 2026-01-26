import { disputeDAL } from "@/dal";
import type { DisputeWithRelations } from "@/dal/types";
import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Deadline enforcement service
 * Handles automatic state transitions when evidence deadlines expire
 */
export class DeadlineEnforcementService {
  /**
   * Check and enforce evidence deadline for a dispute
   * If deadline has expired and dispute is in EVIDENCE_REQUESTED state,
   * automatically transitions to UNDER_REVIEW
   *
   * @param disputeId - ID of the dispute to check
   * @returns Object with enforcement result
   */
  static async checkAndEnforce(disputeId: string): Promise<{
    enforced: boolean;
    previousStatus?: string;
    newStatus?: string;
    error?: string;
  }> {
    try {
      // Get dispute with current status
      const dispute = await disputeDAL.getById(disputeId);

      if (!dispute) {
        return {
          enforced: false,
          error: "Dispute not found",
        };
      }

      // Only enforce for EVIDENCE_REQUESTED state
      if (dispute.status !== "evidence_requested") {
        return {
          enforced: false,
        };
      }

      // Check evidence deadline
      const deadlineCheck = await disputeDAL.checkEvidenceDeadline(disputeId);

      if (!deadlineCheck.expired) {
        return {
          enforced: false,
        };
      }

      // Deadline has expired - transition to UNDER_REVIEW
      const updatedDispute = await disputeDAL.updateState(
        disputeId,
        "under_review",
        undefined, // System-initiated transition (no userId)
        "Evidence deadline expired - automatically moved to review",
      );

      // Create audit log for automatic transition
      await disputeDAL.createAuditLog({
        disputeId,
        actionType: "state_change",
        userId: undefined, // System-initiated
        previousState: dispute.status,
        newState: "under_review",
        reason: "Evidence deadline expired - automatic transition",
      });

      // Send notification about deadline expiration
      // Get rental to find both parties
      if (dispute.rental) {
        const renterId = dispute.rental.renterId;
        const ownerId = dispute.rental.ownerId;

        // Notify both parties
        await Promise.all([
          sendNotification({
            userId: renterId,
            type: "dispute_evidence_deadline_expired",
            title: "Evidence Deadline Expired",
            message: `The evidence deadline for dispute ${disputeId} has expired. The dispute has been moved to review.`,
            data: {
              disputeId,
              rentalId: dispute.rentalId,
            },
            linkUrl: `/dashboard/disputes/${disputeId}`,
          }),
          sendNotification({
            userId: ownerId,
            type: "dispute_evidence_deadline_expired",
            title: "Evidence Deadline Expired",
            message: `The evidence deadline for dispute ${disputeId} has expired. The dispute has been moved to review.`,
            data: {
              disputeId,
              rentalId: dispute.rentalId,
            },
            linkUrl: `/dashboard/disputes/${disputeId}`,
          }),
        ]).catch((error) => {
          // Log notification errors but don't fail the enforcement
          console.error(
            "Failed to send deadline expiration notifications:",
            error,
          );
        });
      }

      return {
        enforced: true,
        previousStatus: dispute.status,
        newStatus: updatedDispute.status,
      };
    } catch (error) {
      console.error("Deadline enforcement failed:", error);
      return {
        enforced: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if a dispute's evidence deadline has expired
   * @param dispute - Dispute to check
   * @returns true if deadline has expired, false otherwise
   */
  static isDeadlineExpired(dispute: DisputeWithRelations): boolean {
    if (dispute.status !== "evidence_requested") {
      return false;
    }

    const deadline = dispute.evidenceDeadline;
    if (!deadline) {
      return false;
    }

    return new Date() > deadline;
  }

  /**
   * Get time remaining until deadline expires
   * @param dispute - Dispute to check
   * @returns Time remaining in milliseconds, or null if no deadline
   */
  static getTimeRemaining(dispute: DisputeWithRelations): number | null {
    if (dispute.status !== "evidence_requested") {
      return null;
    }

    const deadline = dispute.evidenceDeadline;
    if (!deadline) {
      return null;
    }

    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();

    return remaining > 0 ? remaining : 0;
  }
}
