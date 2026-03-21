import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// --- Mocks (vi.hoisted so loggerInstance exists when hoisted mocks run) ---
const { loggerInstance } = vi.hoisted(() => ({
  loggerInstance: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => loggerInstance,
}));

const mockGetUserByConnectedAccountId = vi.fn();
const mockUpdateConnectOnboardingStatus = vi.fn();
const mockGetByPaymentIntentId = vi.fn();
const mockUpdatePaymentStatus = vi.fn();
const mockRecordRefund = vi.fn();
const mockAuditCreate = vi.fn();
const mockPaymentLifecycleGetByRentalId = vi.fn();
const mockPaymentLifecycleGetByTransferId = vi.fn();
const mockUpdateDepositHoldStatus = vi.fn();
const mockUpdateOwnerTransferStatus = vi.fn();

vi.mock("@/dal", () => ({
  userDAL: {
    getUserByConnectedAccountId: (...args: unknown[]) =>
      mockGetUserByConnectedAccountId(...args),
    updateConnectOnboardingStatus: (...args: unknown[]) =>
      mockUpdateConnectOnboardingStatus(...args),
  },
  paymentDAL: {
    getByPaymentIntentId: (...args: unknown[]) =>
      mockGetByPaymentIntentId(...args),
    updatePaymentStatus: (...args: unknown[]) =>
      mockUpdatePaymentStatus(...args),
    recordRefund: (...args: unknown[]) => mockRecordRefund(...args),
  },
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditCreate(...args),
  },
  paymentLifecycleDAL: {
    getByRentalId: (...args: unknown[]) =>
      mockPaymentLifecycleGetByRentalId(...args),
    getByTransferId: (...args: unknown[]) =>
      mockPaymentLifecycleGetByTransferId(...args),
    updateDepositHoldStatus: (...args: unknown[]) =>
      mockUpdateDepositHoldStatus(...args),
    updateOwnerTransferStatus: (...args: unknown[]) =>
      mockUpdateOwnerTransferStatus(...args),
  },
}));

const mockSendOpsAlert = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: (...args: unknown[]) => mockSendOpsAlert(...args),
}));

const mockSendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

vi.mock("@walkup/walkup-utils", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

// Prevent server.ts from loading (it throws if STRIPE_SECRET_KEY is not set).
// chargeback-service imports it via webhook-handlers.
vi.mock("../server", () => ({
  PAYMENT_SERVER_INSTANCE: {},
}));

import { handleWebhookEvent } from "../webhook-handlers";

function createEvent(
  type: string,
  object: Record<string, unknown>,
  id = "evt_test",
): Stripe.Event {
  return {
    id,
    type,
    data: { object },
  } as unknown as Stripe.Event;
}

describe("handleWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditCreate.mockResolvedValue(undefined);
    mockUpdateDepositHoldStatus.mockResolvedValue(undefined);
    mockUpdateOwnerTransferStatus.mockResolvedValue(undefined);
    mockUpdatePaymentStatus.mockResolvedValue(undefined);
    mockRecordRefund.mockResolvedValue(undefined);
  });

  it("logs the received event", async () => {
    const event = createEvent("some.event", {});

    await handleWebhookEvent(event);

    expect(loggerInstance.info).toHaveBeenCalledWith(
      {
        message: "webhook.received",
        eventId: "evt_test",
        eventType: "some.event",
      },
      "Stripe webhook received",
    );
  });

  it("creates audit log for every event", async () => {
    const event = createEvent("some.event", {}, "evt_456");

    await handleWebhookEvent(event);

    expect(mockAuditCreate).toHaveBeenCalledWith({
      entityType: "webhook",
      entityId: "evt_456",
      action: "webhook.processed",
      metadata: { eventType: "some.event" },
    });
  });

  describe("account.updated", () => {
    it("updates onboarding status for known user", async () => {
      mockGetUserByConnectedAccountId.mockResolvedValue({ id: "user-1" });
      mockUpdateConnectOnboardingStatus.mockResolvedValue(undefined);

      await handleWebhookEvent(
        createEvent("account.updated", {
          id: "acct_123",
          charges_enabled: true,
          payouts_enabled: true,
        }),
      );

      expect(mockUpdateConnectOnboardingStatus).toHaveBeenCalledWith("user-1", {
        chargesEnabled: true,
        payoutsEnabled: true,
      });
    });

    it("no-op for unknown account", async () => {
      mockGetUserByConnectedAccountId.mockResolvedValue(null);

      await handleWebhookEvent(
        createEvent("account.updated", {
          id: "acct_unknown",
          charges_enabled: true,
          payouts_enabled: false,
        }),
      );

      expect(mockUpdateConnectOnboardingStatus).not.toHaveBeenCalled();
    });
  });

  describe("account.closed", () => {
    it("disables payment capabilities for known user", async () => {
      mockGetUserByConnectedAccountId.mockResolvedValue({ id: "user-1" });
      mockUpdateConnectOnboardingStatus.mockResolvedValue(undefined);

      await handleWebhookEvent(
        createEvent("account.closed", { id: "acct_123" }),
      );

      expect(mockUpdateConnectOnboardingStatus).toHaveBeenCalledWith("user-1", {
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    });
  });

  describe("payment_intent.succeeded", () => {
    it("updates payment status to 'succeeded' with paidAt", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "pending",
        paidAt: null,
      });

      await handleWebhookEvent(
        createEvent("payment_intent.succeeded", { id: "pi_123" }),
      );

      expect(mockUpdatePaymentStatus).toHaveBeenCalledWith(
        "payment-1",
        "succeeded",
        { paidAt: expect.any(Date) },
      );
    });

    it("preserves existing paidAt if already set", async () => {
      const existingPaidAt = new Date("2025-01-01");
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "pending",
        paidAt: existingPaidAt,
      });

      await handleWebhookEvent(
        createEvent("payment_intent.succeeded", { id: "pi_123" }),
      );

      expect(mockUpdatePaymentStatus).toHaveBeenCalledWith(
        "payment-1",
        "succeeded",
        { paidAt: existingPaidAt },
      );
    });

    it("is idempotent — no-op if already succeeded", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "succeeded",
        paidAt: new Date(),
      });

      await handleWebhookEvent(
        createEvent("payment_intent.succeeded", { id: "pi_123" }),
      );

      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    });

    it("no-op for unknown payment intent", async () => {
      mockGetByPaymentIntentId.mockResolvedValue(null);

      await handleWebhookEvent(
        createEvent("payment_intent.succeeded", { id: "pi_unknown" }),
      );

      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
    });
  });

  describe("payment_intent.payment_failed", () => {
    it("updates payment status to 'failed'", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "pending",
        payerId: "user-1",
        rentalId: "rental-1",
      });

      await handleWebhookEvent(
        createEvent("payment_intent.payment_failed", { id: "pi_123" }),
      );

      expect(mockUpdatePaymentStatus).toHaveBeenCalledWith(
        "payment-1",
        "failed",
      );
    });

    it("sends notification to renter", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "pending",
        payerId: "user-1",
        rentalId: "rental-1",
      });

      await handleWebhookEvent(
        createEvent("payment_intent.payment_failed", { id: "pi_123" }),
      );

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "payment_failed",
          data: { rentalId: "rental-1" },
        }),
      );
    });

    it("logs error but does not throw if notification fails", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "pending",
        payerId: "user-1",
        rentalId: "rental-1",
      });
      mockSendNotification.mockRejectedValueOnce(new Error("Notif error"));

      await expect(
        handleWebhookEvent(
          createEvent("payment_intent.payment_failed", { id: "pi_123" }),
        ),
      ).resolves.toBeUndefined();

      expect(loggerInstance.error).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: "payment-1" }),
        "Failed to send payment failure notification from webhook",
      );
    });

    it("is idempotent — no-op if already failed", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "failed",
        payerId: "user-1",
        rentalId: "rental-1",
      });

      await handleWebhookEvent(
        createEvent("payment_intent.payment_failed", { id: "pi_123" }),
      );

      expect(mockUpdatePaymentStatus).not.toHaveBeenCalled();
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  describe("payment_intent.canceled", () => {
    it("detects deposit hold expiry and updates status", async () => {
      mockPaymentLifecycleGetByRentalId.mockResolvedValue({
        depositHoldStatus: "held",
      });

      await handleWebhookEvent(
        createEvent("payment_intent.canceled", {
          id: "pi_dep_123",
          metadata: {
            paymentType: "security_deposit_hold",
            rentalId: "rental-1",
          },
        }),
      );

      expect(mockUpdateDepositHoldStatus).toHaveBeenCalledWith(
        "rental-1",
        "expired",
      );
    });

    it("sends ops alert for unintentional deposit expiry", async () => {
      mockPaymentLifecycleGetByRentalId.mockResolvedValue({
        depositHoldStatus: "held",
      });

      await handleWebhookEvent(
        createEvent("payment_intent.canceled", {
          id: "pi_dep_123",
          metadata: {
            paymentType: "security_deposit_hold",
            rentalId: "rental-1",
          },
        }),
      );

      expect(mockSendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "deposit_hold_expired_webhook",
          rentalId: "rental-1",
          sendEmailAlert: true,
        }),
      );
    });

    it("no-op for intentional release (status: released)", async () => {
      mockPaymentLifecycleGetByRentalId.mockResolvedValue({
        depositHoldStatus: "released",
      });

      await handleWebhookEvent(
        createEvent("payment_intent.canceled", {
          id: "pi_dep_123",
          metadata: {
            paymentType: "security_deposit_hold",
            rentalId: "rental-1",
          },
        }),
      );

      expect(mockUpdateDepositHoldStatus).not.toHaveBeenCalled();
      expect(mockSendOpsAlert).not.toHaveBeenCalled();
    });

    it("ignores non-deposit PI cancellations", async () => {
      await handleWebhookEvent(
        createEvent("payment_intent.canceled", {
          id: "pi_123",
          metadata: { paymentType: "rental_charge" },
        }),
      );

      expect(mockPaymentLifecycleGetByRentalId).not.toHaveBeenCalled();
    });

    it("ignores cancellations without rentalId metadata", async () => {
      await handleWebhookEvent(
        createEvent("payment_intent.canceled", {
          id: "pi_dep_123",
          metadata: { paymentType: "security_deposit_hold" },
        }),
      );

      expect(mockPaymentLifecycleGetByRentalId).not.toHaveBeenCalled();
    });
  });

  /** UAT-P1-23 (webhook path): transfer.reversed → owner transfer failed + ops alert; no payoutStatus update. */
  describe("transfer.reversed", () => {
    it("sets ownerTransferStatus to 'failed'", async () => {
      mockPaymentLifecycleGetByTransferId.mockResolvedValue({
        rentalId: "rental-1",
      });

      await handleWebhookEvent(
        createEvent("transfer.reversed", { id: "tr_123" }),
      );

      expect(mockUpdateOwnerTransferStatus).toHaveBeenCalledWith(
        "rental-1",
        "failed",
      );
    });

    it("sends ops alert on transfer reversal", async () => {
      mockPaymentLifecycleGetByTransferId.mockResolvedValue({
        rentalId: "rental-1",
      });

      await handleWebhookEvent(
        createEvent("transfer.reversed", { id: "tr_123" }),
      );

      expect(mockSendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "transfer_reversed_webhook",
          rentalId: "rental-1",
          sendEmailAlert: true,
        }),
      );
    });

    it("no-op for unknown transfer", async () => {
      mockPaymentLifecycleGetByTransferId.mockResolvedValue(null);

      await handleWebhookEvent(
        createEvent("transfer.reversed", { id: "tr_unknown" }),
      );

      expect(mockUpdateOwnerTransferStatus).not.toHaveBeenCalled();
      expect(mockSendOpsAlert).not.toHaveBeenCalled();
    });

    it("only calls status update once (no auto-retry)", async () => {
      mockPaymentLifecycleGetByTransferId.mockResolvedValue({
        rentalId: "rental-1",
      });

      await handleWebhookEvent(
        createEvent("transfer.reversed", { id: "tr_123" }),
      );

      expect(mockUpdateOwnerTransferStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("charge.refunded", () => {
    it("updates payment record to refunded with refundedAt and refundAmount", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "succeeded",
        paymentIntentId: "pi_123",
      });

      await handleWebhookEvent(
        createEvent("charge.refunded", {
          id: "ch_123",
          payment_intent: "pi_123",
          amount_refunded: 10050,
          metadata: { reason: "renter_cancellation_24h" },
        }),
      );

      expect(mockRecordRefund).toHaveBeenCalledWith(
        "payment-1",
        expect.objectContaining({
          refundedAt: expect.any(Date),
          refundAmount: "100.50",
          refundReason: "renter_cancellation_24h",
        }),
      );
    });

    it("uses charge.amount_refunded / 100 for refundAmount", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "pay-1",
        status: "succeeded",
      });

      await handleWebhookEvent(
        createEvent("charge.refunded", {
          id: "ch_1",
          payment_intent: "pi_1",
          amount_refunded: 5000,
        }),
      );

      expect(mockRecordRefund).toHaveBeenCalledWith(
        "pay-1",
        expect.objectContaining({
          refundAmount: "50.00",
          refundReason: "stripe_webhook",
        }),
      );
    });

    it("no-op for already-refunded payment", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-1",
        status: "refunded",
      });

      await handleWebhookEvent(
        createEvent("charge.refunded", {
          id: "ch_123",
          payment_intent: "pi_123",
          amount_refunded: 10000,
        }),
      );

      expect(mockRecordRefund).not.toHaveBeenCalled();
    });

    it("logs warning and returns without error for unknown payment", async () => {
      mockGetByPaymentIntentId.mockResolvedValue(null);

      await expect(
        handleWebhookEvent(
          createEvent("charge.refunded", {
            id: "ch_unknown",
            payment_intent: "pi_unknown",
            amount_refunded: 1000,
          }),
        ),
      ).resolves.toBeUndefined();

      expect(mockRecordRefund).not.toHaveBeenCalled();
      expect(loggerInstance.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          chargeId: "ch_unknown",
          paymentIntentId: "pi_unknown",
        }),
        "charge.refunded webhook: no payment record found",
      );
    });

    it("handles payment_intent as object with id", async () => {
      mockGetByPaymentIntentId.mockResolvedValue({
        id: "payment-2",
        status: "succeeded",
      });

      await handleWebhookEvent(
        createEvent("charge.refunded", {
          id: "ch_2",
          payment_intent: { id: "pi_2" },
          amount_refunded: 7500,
        }),
      );

      expect(mockGetByPaymentIntentId).toHaveBeenCalledWith("pi_2");
      expect(mockRecordRefund).toHaveBeenCalledWith(
        "payment-2",
        expect.objectContaining({ refundAmount: "75.00" }),
      );
    });
  });

  describe("unhandled events", () => {
    it("logs unhandled event type without error", async () => {
      await handleWebhookEvent(createEvent("charge.captured", {}));

      expect(loggerInstance.info).toHaveBeenCalledWith(
        { eventType: "charge.captured" },
        expect.stringContaining("Unhandled webhook event type"),
      );
    });
  });
});
