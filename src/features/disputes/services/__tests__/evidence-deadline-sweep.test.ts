import { describe, it, expect, vi, beforeEach } from "vitest";
import { auditLogDAL, disputeDAL } from "@/dal";
import { DeadlineEnforcementService } from "@/features/disputes/lib/deadline-enforcement";
import { sendEvidenceDeadlineApproaching } from "@/features/disputes/notifications/deadline-notifications";
import { captureNonCriticalError } from "@/lib/api/route-helpers";
import { mockDispute } from "@/test/fixtures/disputes";
import {
  REMINDER_ACTION,
  REMINDER_LEAD_MS,
  enforceExpiredDeadlines,
  runEvidenceDeadlineSweep,
  sendDeadlineReminders,
} from "../evidence-deadline-sweep";

vi.mock("@/dal", () => ({
  disputeDAL: {
    listActiveEvidenceDeadlinesBetween: vi.fn(),
    listExpiredEvidenceRequests: vi.fn(),
    getById: vi.fn(),
  },
  auditLogDAL: { exists: vi.fn(), create: vi.fn() },
}));
vi.mock("@/features/disputes/lib/deadline-enforcement", () => ({
  DeadlineEnforcementService: { checkAndEnforce: vi.fn() },
}));
vi.mock("@/features/disputes/notifications/deadline-notifications", () => ({
  sendEvidenceDeadlineApproaching: vi.fn(),
}));
vi.mock("@/lib/api/route-helpers", () => ({
  captureNonCriticalError: vi.fn(),
}));

const NOW = new Date("2026-09-24T12:00:00.000Z");
const DEADLINE = new Date("2026-09-25T09:00:00.000Z");

describe("evidence deadline sweep (P-E13-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(disputeDAL.listActiveEvidenceDeadlinesBetween).mockResolvedValue([
      { id: "d-1", status: "evidence_requested", deadline: DEADLINE },
    ]);
    vi.mocked(disputeDAL.listExpiredEvidenceRequests).mockResolvedValue([]);
    vi.mocked(disputeDAL.getById).mockResolvedValue({
      ...mockDispute,
      id: "d-1",
    });
    vi.mocked(auditLogDAL.exists).mockResolvedValue(false);
    vi.mocked(auditLogDAL.create).mockResolvedValue({} as never);
    vi.mocked(sendEvidenceDeadlineApproaching).mockResolvedValue({
      sent: 2,
      failed: 0,
    });
  });

  describe("reminders", () => {
    it("looks a day ahead of now", async () => {
      await sendDeadlineReminders(NOW);

      expect(
        disputeDAL.listActiveEvidenceDeadlinesBetween,
      ).toHaveBeenCalledWith(
        NOW,
        new Date(NOW.getTime() + REMINDER_LEAD_MS),
        100,
      );
    });

    it("reminds once and records which deadline it reminded about", async () => {
      const result = await sendDeadlineReminders(NOW);

      expect(result).toEqual({ eligible: 1, sent: 1, failed: 0 });
      expect(sendEvidenceDeadlineApproaching).toHaveBeenCalledWith(
        expect.objectContaining({ id: "d-1" }),
        DEADLINE,
      );
      expect(auditLogDAL.create).toHaveBeenCalledWith({
        entityType: "dispute",
        entityId: "d-1",
        action: REMINDER_ACTION,
        metadata: {
          deadline: DEADLINE.toISOString(),
          status: "evidence_requested",
          sent: 2,
          failed: 0,
        },
      });
    });

    // Keyed on the deadline, so a fresh evidence request earns a new reminder.
    it("skips a deadline already reminded about", async () => {
      vi.mocked(auditLogDAL.exists).mockResolvedValue(true);

      const result = await sendDeadlineReminders(NOW);

      expect(auditLogDAL.exists).toHaveBeenCalledWith({
        entityType: "dispute",
        entityId: "d-1",
        action: REMINDER_ACTION,
        metadata: { deadline: DEADLINE.toISOString() },
      });
      expect(sendEvidenceDeadlineApproaching).not.toHaveBeenCalled();
      expect(auditLogDAL.create).not.toHaveBeenCalled();
      expect(result).toEqual({ eligible: 1, sent: 0, failed: 0 });
    });

    it("leaves no marker when nobody got it, so the next run retries", async () => {
      vi.mocked(sendEvidenceDeadlineApproaching).mockResolvedValue({
        sent: 0,
        failed: 2,
      });

      const result = await sendDeadlineReminders(NOW);

      expect(auditLogDAL.create).not.toHaveBeenCalled();
      expect(result.failed).toBe(1);
    });

    // Re-running would repeat it to the party who did get it.
    it("marks a half-delivered reminder done, and reports the failure", async () => {
      vi.mocked(sendEvidenceDeadlineApproaching).mockResolvedValue({
        sent: 1,
        failed: 1,
      });

      const result = await sendDeadlineReminders(NOW);

      expect(auditLogDAL.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ eligible: 1, sent: 0, failed: 1 });
    });

    it("keeps going after one dispute throws", async () => {
      vi.mocked(
        disputeDAL.listActiveEvidenceDeadlinesBetween,
      ).mockResolvedValue([
        { id: "d-1", status: "evidence_requested", deadline: DEADLINE },
        { id: "d-2", status: "under_review", deadline: DEADLINE },
      ]);
      vi.mocked(disputeDAL.getById)
        .mockRejectedValueOnce(new Error("db blip"))
        .mockResolvedValueOnce({ ...mockDispute, id: "d-2" });

      const result = await sendDeadlineReminders(NOW);

      expect(result).toEqual({ eligible: 2, sent: 1, failed: 1 });
      expect(captureNonCriticalError).toHaveBeenCalledTimes(1);
    });
  });

  describe("enforcement", () => {
    it("enforces each expired request, and counts only real failures", async () => {
      vi.mocked(disputeDAL.listExpiredEvidenceRequests).mockResolvedValue([
        "a",
        "b",
        "c",
      ]);
      vi.mocked(DeadlineEnforcementService.checkAndEnforce)
        .mockResolvedValueOnce({ enforced: true, newStatus: "under_review" })
        // Moved by support in between: not a failure.
        .mockResolvedValueOnce({ enforced: false })
        .mockResolvedValueOnce({ enforced: false, error: "boom" });

      const result = await enforceExpiredDeadlines(NOW);

      expect(disputeDAL.listExpiredEvidenceRequests).toHaveBeenCalledWith(
        NOW,
        100,
      );
      expect(result).toEqual({ eligible: 3, enforced: 1, failed: 1 });
    });
  });

  it("reminds before it enforces", async () => {
    const order: string[] = [];
    vi.mocked(disputeDAL.listActiveEvidenceDeadlinesBetween).mockImplementation(
      async () => {
        order.push("remind");
        return [];
      },
    );
    vi.mocked(disputeDAL.listExpiredEvidenceRequests).mockImplementation(
      async () => {
        order.push("enforce");
        return [];
      },
    );

    const result = await runEvidenceDeadlineSweep(NOW);

    expect(order).toEqual(["remind", "enforce"]);
    expect(result).toEqual({
      remindersEligible: 0,
      remindersSent: 0,
      remindersFailed: 0,
      expiredEligible: 0,
      expiredEnforced: 0,
      expiredFailed: 0,
    });
  });
});
