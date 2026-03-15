import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const loggerInstance = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@/lib/logger", () => ({
  getLogger: () => loggerInstance,
}));

const mockHandleChargebackCreated = vi.fn();
const mockHandleChargebackUpdated = vi.fn();
const mockHandleChargebackClosed = vi.fn();

vi.mock("../chargeback-service", () => ({
  ChargebackService: {
    handleChargebackCreated: (...args: unknown[]) =>
      mockHandleChargebackCreated(...args),
    handleChargebackUpdated: (...args: unknown[]) =>
      mockHandleChargebackUpdated(...args),
    handleChargebackClosed: (...args: unknown[]) =>
      mockHandleChargebackClosed(...args),
  },
}));

const mockAuditCreate = vi.fn();
vi.mock("@/dal", () => ({
  userDAL: { getUserByConnectedAccountId: vi.fn() },
  paymentDAL: {
    getByPaymentIntentId: vi.fn(),
    recordRefund: vi.fn(),
  },
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditCreate(...args),
  },
  paymentLifecycleDAL: {
    getByRentalId: vi.fn(),
    getByTransferId: vi.fn(),
    updateDepositHoldStatus: vi.fn(),
  },
}));

vi.mock("@/features/notifications/lib/ops-alerts", () => ({
  sendOpsAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/notifications/utils/send-notification", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

import { handleWebhookEvent } from "../webhook-handlers";

function createMockEvent(type: string, data: Record<string, unknown>) {
  return {
    id: "evt_123",
    type,
    data: { object: data },
  } as unknown as Stripe.Event;
}

describe("handleWebhookEvent - chargeback events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditCreate.mockResolvedValue(undefined);
    mockHandleChargebackCreated.mockResolvedValue(undefined);
    mockHandleChargebackUpdated.mockResolvedValue(undefined);
    mockHandleChargebackClosed.mockResolvedValue(undefined);
  });

  it("charge.dispute.created → ChargebackService.handleChargebackCreated called, audit log created", async () => {
    const disputeObject = {
      id: "dp_123",
      charge: "ch_123",
      payment_intent: "pi_123",
    };

    await handleWebhookEvent(
      createMockEvent("charge.dispute.created", disputeObject),
    );

    expect(mockHandleChargebackCreated).toHaveBeenCalledWith(disputeObject);
    expect(mockAuditCreate).toHaveBeenCalledWith({
      entityType: "webhook",
      entityId: "evt_123",
      action: "webhook.processed",
      metadata: { eventType: "charge.dispute.created" },
    });
  });

  it("charge.dispute.closed → ChargebackService.handleChargebackClosed called, audit log created", async () => {
    const disputeObject = {
      id: "dp_456",
      charge: "ch_456",
      status: "won",
    };

    await handleWebhookEvent(
      createMockEvent("charge.dispute.closed", disputeObject),
    );

    expect(mockHandleChargebackClosed).toHaveBeenCalledWith(disputeObject);
    expect(mockAuditCreate).toHaveBeenCalledWith({
      entityType: "webhook",
      entityId: "evt_123",
      action: "webhook.processed",
      metadata: { eventType: "charge.dispute.closed" },
    });
  });

  it("idempotent: call twice with same event, verify handleChargebackCreated called twice", async () => {
    const disputeObject = {
      id: "dp_789",
      charge: "ch_789",
      payment_intent: "pi_789",
    };
    const event = createMockEvent("charge.dispute.created", disputeObject);

    await handleWebhookEvent(event);
    await handleWebhookEvent(event);

    expect(mockHandleChargebackCreated).toHaveBeenCalledTimes(2);
    expect(mockHandleChargebackCreated).toHaveBeenNthCalledWith(
      1,
      disputeObject,
    );
    expect(mockHandleChargebackCreated).toHaveBeenNthCalledWith(
      2,
      disputeObject,
    );
  });
});
