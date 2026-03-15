import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChargebackService } from "../chargeback-service";
import { PAYMENT_SERVER_INSTANCE } from "../server";
import {
  disputeDAL,
  paymentDAL,
  paymentLifecycleDAL,
  auditLogDAL,
  legalDocumentDAL,
} from "@/dal";
import { sendOpsAlert } from "@/features/notifications/lib/ops-alerts";
import { ValidationError } from "@/dal/errors";

vi.mock("../server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    disputes: { update: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/dal", () => ({
  disputeDAL: {
    getActiveByRentalId: vi.fn(),
    updateStripeChargebackId: vi.fn(),
    create: vi.fn(),
    createAuditLog: vi.fn(),
    getById: vi.fn(),
    getEvidenceByDisputeId: vi.fn(),
  },
  paymentDAL: {
    getByChargeId: vi.fn(),
    getByPaymentIntentId: vi.fn(),
  },
  paymentLifecycleDAL: {
    freezeForDispute: vi.fn(),
  },
  auditLogDAL: { create: vi.fn() },
  legalDocumentDAL: {
    getCurrentVersion: vi.fn(),
  },
}));

vi.mock("@/constants/legal-documents", () => ({
  LEGAL_DOCUMENT_IDS: { DISPUTE_POLICY: "dispute-policy-id" },
}));

vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn().mockResolvedValue(undefined),
}));

const mockStripeDispute = {
  id: "dp_stripe_123",
  charge: "ch_123",
  payment_intent: "pi_123",
  amount: 15000,
  currency: "usd",
  reason: "fraudulent",
  status: "needs_response",
} as any;

describe("ChargebackService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleChargebackCreated", () => {
    it("37.1 handleChargebackCreated with existing dispute", async () => {
      const mockPayment = {
        id: "payment-123",
        rentalId: "rental-123",
        stripeChargeId: "ch_123",
      };
      const existingDispute = {
        id: "dispute-456",
        rentalId: "rental-123",
        stripeChargebackId: null,
      };

      vi.mocked(paymentDAL.getByChargeId).mockResolvedValue(mockPayment as any);
      vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(
        existingDispute as any,
      );
      vi.mocked(disputeDAL.updateStripeChargebackId).mockResolvedValue(
        undefined,
      );
      vi.mocked(paymentLifecycleDAL.freezeForDispute).mockResolvedValue(
        undefined as any,
      );

      await ChargebackService.handleChargebackCreated(mockStripeDispute);

      expect(disputeDAL.updateStripeChargebackId).toHaveBeenCalledWith(
        "dispute-456",
        "dp_stripe_123",
      );
      expect(paymentLifecycleDAL.freezeForDispute).toHaveBeenCalledWith(
        "rental-123",
      );
      expect(sendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "chargeback_created",
          rentalId: "rental-123",
        }),
      );
    });

    it("37.2 handleChargebackCreated without existing dispute", async () => {
      const mockPayment = {
        id: "payment-123",
        rentalId: "rental-123",
        stripeChargeId: "ch_123",
      };
      const autoDispute = {
        id: "dispute-new",
        rentalId: "rental-123",
        stripeChargebackId: null,
      };

      vi.mocked(paymentDAL.getByChargeId).mockResolvedValue(mockPayment as any);
      vi.mocked(disputeDAL.getActiveByRentalId).mockResolvedValue(null);
      vi.mocked(disputeDAL.create).mockResolvedValue(autoDispute as any);
      vi.mocked(disputeDAL.updateStripeChargebackId).mockResolvedValue(
        undefined,
      );
      vi.mocked(disputeDAL.createAuditLog).mockResolvedValue(undefined as any);
      vi.mocked(paymentLifecycleDAL.freezeForDispute).mockResolvedValue(
        undefined as any,
      );
      vi.mocked(legalDocumentDAL.getCurrentVersion).mockResolvedValue({
        version: "v1.0",
      } as any);

      await ChargebackService.handleChargebackCreated(mockStripeDispute);

      expect(disputeDAL.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rentalId: "rental-123",
          createdBy: "system",
          createdByRole: "renter",
          reasonCode: "payment_issue",
          description: expect.stringContaining(
            "Auto-created from Stripe chargeback",
          ),
        }),
      );
      expect(disputeDAL.updateStripeChargebackId).toHaveBeenCalledWith(
        "dispute-new",
        "dp_stripe_123",
      );
      expect(disputeDAL.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: "dispute-new",
          actionType: "dispute_created",
          details: expect.objectContaining({
            source: "stripe_chargeback",
            stripeDisputeId: "dp_stripe_123",
            chargeId: "ch_123",
          }),
        }),
      );
      expect(paymentLifecycleDAL.freezeForDispute).toHaveBeenCalledWith(
        "rental-123",
      );
    });

    it("37.3 handleChargebackCreated unknown charge", async () => {
      vi.mocked(paymentDAL.getByChargeId).mockResolvedValue(null);
      vi.mocked(paymentDAL.getByPaymentIntentId).mockResolvedValue(null);

      await ChargebackService.handleChargebackCreated(mockStripeDispute);

      expect(disputeDAL.create).not.toHaveBeenCalled();
      expect(disputeDAL.updateStripeChargebackId).not.toHaveBeenCalled();
      expect(sendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "chargeback_unlinked",
          rentalId: "unknown",
          message: expect.stringContaining("no matching payment found"),
        }),
      );
    });
  });

  describe("submitEvidence", () => {
    it("37.4 submitEvidence", async () => {
      const dispute = {
        id: "dispute-123",
        stripeChargebackId: "dp_stripe_123",
        referenceNumber: 42,
        description: "Tool damage",
      };
      const evidenceRecords = [
        {
          id: "ev-1",
          disputeId: "dispute-123",
          evidenceType: "text",
          content: "Rental agreement signed",
        },
      ];

      vi.mocked(disputeDAL.getById).mockResolvedValue(dispute as any);
      vi.mocked(disputeDAL.getEvidenceByDisputeId).mockResolvedValue(
        evidenceRecords as any,
      );
      vi.mocked(disputeDAL.createAuditLog).mockResolvedValue(undefined as any);
      vi.mocked(PAYMENT_SERVER_INSTANCE.disputes.update).mockResolvedValue(
        {} as any,
      );
      vi.mocked(auditLogDAL.create).mockResolvedValue(undefined as any);

      await ChargebackService.submitEvidence("dispute-123", "admin-1");

      expect(PAYMENT_SERVER_INSTANCE.disputes.update).toHaveBeenCalledWith(
        "dp_stripe_123",
        expect.objectContaining({
          evidence: expect.objectContaining({
            product_description: expect.stringContaining("Hoador tool rental"),
            customer_communication: "Rental agreement signed",
            service_documentation: "Tool damage",
          }),
        }),
        { idempotencyKey: "chargeback-evidence-dispute-123" },
      );
    });

    it("37.5 submitEvidence without stripeChargebackId", async () => {
      const dispute = {
        id: "dispute-123",
        stripeChargebackId: null,
        referenceNumber: 42,
        description: "Tool damage",
      };

      vi.mocked(disputeDAL.getById).mockResolvedValue(dispute as any);

      await expect(
        ChargebackService.submitEvidence("dispute-123", "admin-1"),
      ).rejects.toThrow(ValidationError);

      expect(PAYMENT_SERVER_INSTANCE.disputes.update).not.toHaveBeenCalled();
    });
  });
});
