import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_test";

const mockConstructEvent = vi.fn();
const loggerInstance = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
const mockGetLogger = vi.fn(() => loggerInstance);
const mockAuditCreate = vi.fn();
const mockRunWithRequestContext = vi.fn((_ctx: unknown, fn: () => unknown) =>
  fn(),
);
const mockGenerateRequestId = vi.fn(() => "req-1");

vi.mock("@/services/stripe/server", () => ({
  PAYMENT_SERVER_INSTANCE: {
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  getLogger: () => mockGetLogger(),
  runWithRequestContext: (ctx: unknown, fn: () => unknown) =>
    mockRunWithRequestContext(ctx, fn),
  generateRequestId: () => mockGenerateRequestId(),
}));
vi.mock("@/dal", () => ({
  auditLogDAL: {
    create: (...args: unknown[]) => mockAuditCreate(...args),
  },
}));
vi.mock("@/dal/user.dal", () => ({
  UserDAL: class MockUserDAL {
    getUserByConnectedAccountId = vi.fn().mockResolvedValue(null);
    updateConnectOnboardingStatus = vi.fn().mockResolvedValue(undefined);
  },
}));
vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (req: NextRequest) => Promise<unknown>) =>
    handler,
}));

const { POST } = await import("../route");

describe("POST /api/stripe/webhooks", () => {
  const validBody = JSON.stringify({
    id: "evt_123",
    type: "account.updated",
    data: { object: { id: "acct_1" } },
  });
  const signature = "stripe-signature";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on signature verification failure, logs error and returns 400 without creating audit row", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const request = new NextRequest("http://localhost/api/stripe/webhooks", {
      method: "POST",
      body: validBody,
      headers: { "stripe-signature": signature },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(loggerInstance.error).toHaveBeenCalledWith(
      { message: "webhook.signature_verification_failed" },
      "Stripe webhook signature verification failed",
    );
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("on successful webhook handling, logs event id/type and creates audit row with webhook.processed", async () => {
    const eventId = "evt_456";
    const eventType = "account.updated";
    mockConstructEvent.mockReturnValue({
      id: eventId,
      type: eventType,
      data: { object: { id: "acct_1" } },
    });

    const request = new NextRequest("http://localhost/api/stripe/webhooks", {
      method: "POST",
      body: validBody,
      headers: { "stripe-signature": signature },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(loggerInstance.info).toHaveBeenCalledWith(
      {
        message: "webhook.received",
        eventId,
        eventType,
      },
      "Stripe webhook received",
    );
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledWith({
      entityType: "webhook",
      entityId: eventId,
      action: "webhook.processed",
      metadata: { eventType },
    });
  });
});
