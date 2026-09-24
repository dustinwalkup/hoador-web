import { disputeDAL } from "@/dal";
import type { DisputeWithRelations } from "@/dal/types";
import { sendEvidenceDeadlineExpired } from "@/features/disputes/notifications/deadline-notifications";

/**
 * Deadline enforcement service
 * Handles automatic state transitions when evidence deadlines expire.
 *
 * Run hourly by `GET /api/cron/evidence-deadlines` (P-E13-9). Until then it
 * had no production caller, so an expired `evidence_requested` dispute stayed
 * there until support moved it.
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

      // Deadline has expired - transition to UNDER_REVIEW, but only if it is
      // still EVIDENCE_REQUESTED. Support can move or resolve it between the
      // read above and this write, and a plain update would overwrite that.
      const moved = await disputeDAL.transitionIfStatus(
        disputeId,
        "evidence_requested",
        "under_review",
      );
      if (!moved) {
        return { enforced: false };
      }

      // Create audit log for automatic transition
      await disputeDAL.createAuditLog({
        disputeId,
        actionType: "state_change",
        userId: undefined, // System-initiated
        previousState: dispute.status,
        newState: "under_review",
        reason: "Evidence deadline expired - automatic transition",
      });

      // Both parties, either marketplace. This used to notify rental disputes
      // only (`if (dispute.rental)`), so a service dispute moved silently.
      // Deliberately no additional 48h window: the state route adds one when
      // SUPPORT moves a dispute to review, but here the window just ran out,
      // and reopening it for two more days would undo the deadline.
      await sendEvidenceDeadlineExpired(dispute).catch((error) => {
        // Log notification errors but don't fail the enforcement
        console.error(
          "Failed to send deadline expiration notifications:",
          error,
        );
      });

      return {
        enforced: true,
        previousStatus: dispute.status,
        newStatus: "under_review",
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
