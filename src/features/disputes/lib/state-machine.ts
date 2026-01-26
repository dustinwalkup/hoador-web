import type { DisputeStatus } from "@/dal/types";

/**
 * Valid state transitions for dispute status
 * Based on Requirement 3.4 from disputes requirements
 */
const VALID_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["evidence_requested", "under_review", "resolved"],
  evidence_requested: ["under_review", "resolved"],
  under_review: ["resolved"],
  resolved: ["closed"],
  closed: [], // Terminal state - no transitions allowed
};

/**
 * States that require admin privileges to transition to
 */
const ADMIN_ONLY_STATES: DisputeStatus[] = [
  "evidence_requested",
  "under_review",
  "resolved",
  "closed",
];

/**
 * Final states that cannot be modified
 */
const FINAL_STATES: DisputeStatus[] = ["resolved", "closed"];

/**
 * Dispute state machine service
 * Validates state transitions and enforces business rules
 */
export class DisputeStateMachine {
  /**
   * Check if a transition from one state to another is allowed
   * @param from - Current dispute status
   * @param to - Desired new status
   * @returns true if transition is valid, false otherwise
   */
  static canTransition(from: DisputeStatus, to: DisputeStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[from];
    return allowedTransitions?.includes(to) ?? false;
  }

  /**
   * Validate a state transition with full business rules
   * Checks transition validity, final state protection, and admin requirements
   *
   * @param currentStatus - Current dispute status
   * @param newStatus - Desired new status
   * @param isAdmin - Whether the user has admin privileges
   * @returns Validation result with error message if invalid
   */
  static validateTransition(
    currentStatus: DisputeStatus,
    newStatus: DisputeStatus,
    isAdmin: boolean,
  ): { valid: boolean; error?: string } {
    // Check if dispute is in final state (immutable)
    if (FINAL_STATES.includes(currentStatus)) {
      return {
        valid: false,
        error: `Dispute is in final state (${currentStatus}) and cannot be modified`,
      };
    }

    // Check if transition is allowed
    if (!this.canTransition(currentStatus, newStatus)) {
      return {
        valid: false,
        error: `Invalid transition from ${currentStatus} to ${newStatus}`,
      };
    }

    // Check if admin privileges are required
    if (ADMIN_ONLY_STATES.includes(newStatus) && !isAdmin) {
      return {
        valid: false,
        error: `Admin privileges required to transition to ${newStatus}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get all valid next states for a given current state
   * @param currentStatus - Current dispute status
   * @returns Array of valid next states
   */
  static getValidNextStates(currentStatus: DisputeStatus): DisputeStatus[] {
    return VALID_TRANSITIONS[currentStatus] ?? [];
  }

  /**
   * Check if a state is a final state (cannot be modified)
   * @param status - Dispute status to check
   * @returns true if status is final, false otherwise
   */
  static isFinalState(status: DisputeStatus): boolean {
    return FINAL_STATES.includes(status);
  }

  /**
   * Check if a state requires admin privileges
   * @param status - Dispute status to check
   * @returns true if admin privileges are required, false otherwise
   */
  static requiresAdmin(status: DisputeStatus): boolean {
    return ADMIN_ONLY_STATES.includes(status);
  }
}
