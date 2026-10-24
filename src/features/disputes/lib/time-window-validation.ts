import type { DisputeReasonCode } from "@/dal/types";
import { wallClockToInstant } from "@/lib/wall-clock-zone";

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
   * @deprecated Use `isDisputeFilingWindowOpen` instead, which uses the unified 24h window
   * @param startDate - Rental start date
   * @param endDate - Rental end date
   * @returns True if the longest filing window has expired, false otherwise
   */
  static isDisputeFilingWindowExpired(startDate: Date, endDate: Date): boolean {
    const longestDeadline = new Date(endDate);
    longestDeadline.setDate(longestDeadline.getDate() + 30);

    const now = new Date();
    return now > longestDeadline;
  }

  /**
   * Unified filing window check based on Phase 3 requirements.
   *
   * - If `returnConfirmedAt` is set the window is 24 hours after that timestamp.
   * - If `returnConfirmedAt` is not set (pre-return / no-show), the window opens
   *   once `now >= startDate` and has no deadline (caller restricts to approved/active).
   *
   * @param startDate - When the rental starts, as an instant: the server's
   *   `pickupInstant` (midnight Central of the booked day). Not the raw stored
   *   day, which a browser reads in its own zone (HOA-124).
   * @param returnConfirmedAt - When the owner confirmed the return (null if not yet returned)
   * @param now - Current date (injectable for testing)
   * @returns True if the filing window is currently open
   */
  static isDisputeFilingWindowOpen(
    startDate: Date,
    returnConfirmedAt: Date | null | undefined,
    now: Date = new Date(),
  ): boolean {
    if (returnConfirmedAt) {
      const deadline = new Date(
        returnConfirmedAt.getTime() + 24 * 60 * 60 * 1000,
      );
      return now <= deadline;
    }
    return now >= startDate;
  }

  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  /**
   * The scheduled service start, from the booking's date + time read as a
   * **Central wall clock** (`wallClockToInstant`), the same reading as
   * `serviceInstant` behind accept, complete, refund tiers and payouts.
   *
   * It used to be `new Date("YYYY-MM-DDTHH:MM")`, which parses in whatever zone
   * the code runs in: UTC on the server, so a 10am job "started" at 5am
   * Central and a never-completed booking's dispute window closed five hours
   * early (HOA-124). Also run in the browser by the web detail page, where it
   * now gives the same answer as the server.
   *
   * An unreadable value gives an Invalid Date, as before.
   */
  static parseServiceScheduledAt(
    proposedDate: string,
    proposedTime: string,
  ): Date {
    return wallClockToInstant(proposedDate, proposedTime) ?? new Date(NaN);
  }

  /**
   * Start of the scheduled calendar day for "day of" eligibility: Central
   * midnight, not the server's (UTC) midnight, which is 7pm Central the
   * evening before (HOA-124).
   */
  static parseServiceDayStart(proposedDate: string): Date {
    return wallClockToInstant(proposedDate, "00:00") ?? new Date(NaN);
  }

  /**
   * Service booking dispute window (aligned with rental 24h rule):
   * - Opens on the scheduled service date (calendar day), or at `completedAt`
   *   if the booking was marked complete before that day.
   * - Closes 24 hours after `completedAt` if set, otherwise 24 hours after scheduled date+time.
   */
  static validateServiceFilingWindow(
    proposedDate: string,
    proposedTime: string,
    completedAt: Date | null | undefined,
    now: Date = new Date(),
  ): TimeWindowValidationResult {
    const dayStart = TimeWindowValidation.parseServiceDayStart(proposedDate);
    // A booking completed before its day (possible until BIZ-02 blocked it)
    // would otherwise close its window before opening it: the close is
    // `completedAt + 24h`, the open was `dayStart`.
    const windowOpensAt =
      completedAt && completedAt < dayStart ? completedAt : dayStart;
    if (now < windowOpensAt) {
      return {
        valid: false,
        message: "Disputes cannot be filed before the scheduled service date",
      };
    }

    const deadline = completedAt
      ? new Date(completedAt.getTime() + TimeWindowValidation.MS_PER_DAY)
      : new Date(
          TimeWindowValidation.parseServiceScheduledAt(
            proposedDate,
            proposedTime,
          ).getTime() + TimeWindowValidation.MS_PER_DAY,
        );

    if (now > deadline) {
      return {
        valid: false,
        message: completedAt
          ? "The dispute filing window closed 24 hours after the service was marked complete"
          : "The dispute filing window closed 24 hours after the scheduled service time",
        deadline,
      };
    }

    return { valid: true, deadline };
  }
}
