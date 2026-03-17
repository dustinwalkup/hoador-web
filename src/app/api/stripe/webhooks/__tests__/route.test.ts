import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_test";

// --- Mocks ---
const mockConstructEvent = vi.fn();
const loggerInstance = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
const mockGetLogger = vi.fn(() => loggerInstance);
const mockHandleWebhookEvent = vi.fn();
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

vi.mock("@/services/stripe/webhook-handlers", () => ({
  handleWebhookEvent: (...args: unknown[]) => mockHandleWebhookEvent(...args),
}));

vi.mock("@/lib/api/with-request-logging", () => ({
  withRequestLogging: (handler: (req: NextRequest) => Promise<unknown>) =>
    handler,
}));

const { POST } = await import("../route");

function createWebhookRequest(
  body: string = "{}",
  signature: string = "stripe-signature",
): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhooks", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}

describe("POST /api/stripe/webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleWebhookEvent.mockResolvedValue(undefined);
  });

  it("returns 400 when signature is missing", async () => {
    const request = new NextRequest("http://localhost/api/stripe/webhooks", {
      method: "POST",
      body: "{}",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Missing signature or webhook secret");
  });

  it("returns 400 on signature verification failure and logs error", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(400);
    expect(loggerInstance.error).toHaveBeenCalledWith(
      { message: "webhook.signature_verification_failed" },
      "Stripe webhook signature verification failed",
    );
    expect(mockHandleWebhookEvent).not.toHaveBeenCalled();
  });

  it("calls handleWebhookEvent with verified event and returns 200", async () => {
    const event = {
      id: "evt_123",
      type: "account.updated",
      data: { object: { id: "acct_1" } },
    };
    mockConstructEvent.mockReturnValue(event);

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.received).toBe(true);
    expect(mockHandleWebhookEvent).toHaveBeenCalledWith(event);
  });

  it("returns 500 when handleWebhookEvent throws", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_123",
      type: "account.updated",
      data: { object: {} },
    });
    mockHandleWebhookEvent.mockRejectedValue(new Error("Handler error"));

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Webhook handler failed");
  });

  it("passes body and signature to constructEvent", async () => {
    const body = '{"test": true}';
    const sig = "whsec_test_sig";
    mockConstructEvent.mockReturnValue({
      id: "evt_1",
      type: "test",
      data: { object: {} },
    });

    await POST(createWebhookRequest(body, sig));

    expect(mockConstructEvent).toHaveBeenCalledWith(body, sig, "whsec_test");
  });
});
