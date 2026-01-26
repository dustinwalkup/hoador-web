import type { DisputeReasonCode } from "@/dal/types";

export interface TimeWindowValidationResult {
  valid: boolean;
  message?: string;
  deadline?: Date;
}

/**
 * Time window validation utility
 * Calculates time windows for dispute creation based on reason codes
 * Extracted from DAL for reuse across layers
 */
export class TimeWindowValidation {
  /**
   * Calculate the deadline date for a dispute based on reason code and rental dates
   *
   * @param startDate - Rental start date
   * @param endDate - Rental end date
   * @param reasonCode - Dispute reason code
   * @returns Deadline date for the dispute
   */
  static calculateDeadline(
    startDate: Date,
    endDate: Date,
    reasonCode: DisputeReasonCode,
  ): Date {
    const deadline = new Date();

    switch (reasonCode) {
      case "damage":
        // 7 days after endDate
        deadline.setTime(endDate.getTime());
        deadline.setDate(deadline.getDate() + 7);
        break;
      case "non_delivery":
        // 3 days after startDate
        deadline.setTime(startDate.getTime());
        deadline.setDate(deadline.getDate() + 3);
        break;
      case "quality_issue":
        // 7 days after endDate
        deadline.setTime(endDate.getTime());
        deadline.setDate(deadline.getDate() + 7);
        break;
      case "cancellation":
        // 2 days after cancellation (use startDate as proxy for cancellation date)
        deadline.setTime(startDate.getTime());
        deadline.setDate(deadline.getDate() + 2);
        break;
      case "payment_issue":
        // 30 days after payment (use endDate as proxy)
        deadline.setTime(endDate.getTime());
        deadline.setDate(deadline.getDate() + 30);
        break;
      case "other":
        // 14 days after endDate
        deadline.setTime(endDate.getTime());
        deadline.setDate(deadline.getDate() + 14);
        break;
      default:
        // Fallback: 14 days after endDate
        deadline.setTime(endDate.getTime());
        deadline.setDate(deadline.getDate() + 14);
    }

    return deadline;
  }

  /**
   * Validate if current time is within the allowed time window for dispute creation
   *
   * @param startDate - Rental start date
   * @param endDate - Rental end date
   * @param reasonCode - Dispute reason code
   * @returns Validation result with validity, message, and deadline
   */
  static validateTimeWindow(
    startDate: Date,
    endDate: Date,
    reasonCode: DisputeReasonCode,
  ): TimeWindowValidationResult {
    const deadline = this.calculateDeadline(startDate, endDate, reasonCode);
    const now = new Date();

    const valid = now <= deadline;

    return {
      valid,
      deadline,
      message: valid
        ? undefined
        : `Time window expired. Deadline was ${deadline.toISOString()}`,
    };
  }

  /**
   * Get human-readable description of time window for a reason code
   *
   * @param reasonCode - Dispute reason code
   * @returns Description of the time window
   */
  static getTimeWindowDescription(reasonCode: DisputeReasonCode): string {
    switch (reasonCode) {
      case "damage":
        return "7 days after rental end date";
      case "non_delivery":
        return "3 days after rental start date";
      case "quality_issue":
        return "7 days after rental end date";
      case "cancellation":
        return "2 days after cancellation";
      case "payment_issue":
        return "30 days after payment";
      case "other":
        return "14 days after rental end date";
      default:
        return "14 days after rental end date";
    }
  }

  /**
   * Check if the dispute filing window has expired for all possible dispute types
   * Uses the longest possible filing window (30 days for payment issues) as the cutoff
   *
   * @param startDate - Rental start date
   * @param endDate - Rental end date
   * @returns True if the longest filing window has expired, false otherwise
   */
  static isDisputeFilingWindowExpired(startDate: Date, endDate: Date): boolean {
    // The longest filing window is 30 days for payment issues (calculated from endDate)
    // If this window has expired, all other dispute types are also expired
    const longestDeadline = new Date(endDate);
    longestDeadline.setDate(longestDeadline.getDate() + 30);

    const now = new Date();
    return now > longestDeadline;
  }
}
