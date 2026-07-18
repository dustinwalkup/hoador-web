import { describe, it, expect } from "vitest";
import {
  BLOCKING_RENTAL_STATUSES,
  BLOCKING_BOOKING_STATUSES,
  BLOCKING_DEPOSIT_STATUSES,
  BLOCKING_PAYOUT_STATUSES,
  BLOCKING_TRANSFER_STATUSES,
  BLOCKING_DISPUTE_STATUSES,
} from "../account-deletion.dal";
import {
  rentalStatusEnum,
  serviceBookingStatusEnum,
  depositHoldStatusEnum,
  payoutStatusEnum,
  ownerTransferStatusEnum,
  disputeStatusEnum,
} from "@/db/schemas/_enums";

/**
 * The blocking-state sets are the load-bearing decision in account deletion
 * (D-E2-8). Testing them directly — rather than through the DB queries that
 * consume them — is how the "which states block" rule gets verified in the
 * repo's DB-less unit suite.
 *
 * Requirements: 2.5.2
 * Spec: hoador-mobile/specs/mobile-app/tasks/epic-02-backend-services.md § 2.6.1
 */

describe("account-deletion blocking states", () => {
  it("every blocking value is a real enum value (no typos)", () => {
    // A typo'd status would silently never match, so a whole blocker class
    // would go dark. Pin each set to its enum.
    const subset = (vals: readonly string[], enumVals: readonly string[]) =>
      vals.every((v) => enumVals.includes(v));

    expect(subset(BLOCKING_RENTAL_STATUSES, rentalStatusEnum.enumValues)).toBe(
      true,
    );
    expect(
      subset(BLOCKING_BOOKING_STATUSES, serviceBookingStatusEnum.enumValues),
    ).toBe(true);
    expect(
      subset(BLOCKING_DEPOSIT_STATUSES, depositHoldStatusEnum.enumValues),
    ).toBe(true);
    expect(subset(BLOCKING_PAYOUT_STATUSES, payoutStatusEnum.enumValues)).toBe(
      true,
    );
    expect(
      subset(BLOCKING_TRANSFER_STATUSES, ownerTransferStatusEnum.enumValues),
    ).toBe(true);
    expect(
      subset(BLOCKING_DISPUTE_STATUSES, disputeStatusEnum.enumValues),
    ).toBe(true);
  });

  it("does not block on terminal failure states (D-E2-8)", () => {
    // The whole point: a permanently-failed deposit/payout/transfer must never
    // trap an account. If any of these start blocking, deletion can become
    // unreachable and the app falls out of store compliance.
    expect(BLOCKING_DEPOSIT_STATUSES).not.toContain("failed");
    expect(BLOCKING_DEPOSIT_STATUSES).not.toContain("release_failed");
    expect(BLOCKING_PAYOUT_STATUSES).not.toContain("failed");
    expect(BLOCKING_TRANSFER_STATUSES).not.toContain("failed");
  });

  it("does not block on terminal lifecycle states that are simply done", () => {
    for (const done of ["completed", "cancelled", "denied"]) {
      expect(BLOCKING_RENTAL_STATUSES).not.toContain(done);
    }
    for (const done of ["completed", "cancelled", "declined"]) {
      expect(BLOCKING_BOOKING_STATUSES).not.toContain(done);
    }
    for (const done of ["released", "expired", "captured", "not_applicable"]) {
      expect(BLOCKING_DEPOSIT_STATUSES).not.toContain(done);
    }
    for (const done of ["resolved", "closed"]) {
      expect(BLOCKING_DISPUTE_STATUSES).not.toContain(done);
    }
    expect(BLOCKING_PAYOUT_STATUSES).not.toContain("completed");
    expect(BLOCKING_TRANSFER_STATUSES).not.toContain("completed");
  });

  it("blocks on the in-flight states that genuinely hold value or a counterpart", () => {
    // A `frozen` transfer (open dispute) and a `payment_failed` booking (awaiting
    // the requester's card) are non-terminal and must block.
    expect(BLOCKING_TRANSFER_STATUSES).toContain("frozen");
    expect(BLOCKING_BOOKING_STATUSES).toContain("payment_failed");
    expect(BLOCKING_RENTAL_STATUSES).toContain("overdue");
  });
});
