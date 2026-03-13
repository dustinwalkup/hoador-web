import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLoggerError = vi.fn();
const mockSendEmail = vi.fn();

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    error: (...args: unknown[]) => mockLoggerError(...args),
  }),
}));

vi.mock("@/features/notifications/utils/send-email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

describe("sendOpsAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Re-mock after resetModules
    vi.mock("@/lib/logger", () => ({
      getLogger: () => ({
        error: (...args: unknown[]) => mockLoggerError(...args),
      }),
    }));
    vi.mock("@/features/notifications/utils/send-email", () => ({
      sendEmail: (...args: unknown[]) => mockSendEmail(...args),
    }));
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("logs with getLogger().error() with alertType: 'ops'", async () => {
    const { sendOpsAlert } = await import("../ops-alerts");

    await sendOpsAlert({
      event: "deposit_hold_failed",
      rentalId: "rental-1",
      message: "Hold failed",
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "ops",
        event: "deposit_hold_failed",
        rentalId: "rental-1",
      }),
      "Hold failed",
    );
  });

  it("includes event, rentalId, metadata in structured log", async () => {
    const { sendOpsAlert } = await import("../ops-alerts");

    await sendOpsAlert({
      event: "transfer_failed",
      rentalId: "rental-2",
      message: "Transfer error",
      metadata: { ownerId: "owner-1" },
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "ops",
        event: "transfer_failed",
        rentalId: "rental-2",
        ownerId: "owner-1",
      }),
      "Transfer error",
    );
  });

  it("sends email when OPS_ALERT_EMAIL is configured and sendEmailAlert is true", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@test.com";
    const { sendOpsAlert } = await import("../ops-alerts");

    await sendOpsAlert({
      event: "test_event",
      rentalId: "rental-1",
      message: "test",
      sendEmailAlert: true,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@test.com",
      }),
    );

    delete process.env.OPS_ALERT_EMAIL;
  });

  it("email subject includes event type and rental ID", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@test.com";
    const { sendOpsAlert } = await import("../ops-alerts");

    await sendOpsAlert({
      event: "deposit_hold_expired",
      rentalId: "rental-99",
      message: "Expired",
      sendEmailAlert: true,
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ops@test.com",
        subject: "[Hoador Ops] deposit_hold_expired — Rental rental-99",
      }),
    );

    delete process.env.OPS_ALERT_EMAIL;
  });

  it("does NOT send email when sendEmailAlert is false", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@test.com";
    const { sendOpsAlert } = await import("../ops-alerts");

    await sendOpsAlert({
      event: "test",
      rentalId: "rental-1",
      message: "test",
      sendEmailAlert: false,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
    delete process.env.OPS_ALERT_EMAIL;
  });

  it("does NOT send email when OPS_ALERT_EMAIL is not set", async () => {
    delete process.env.OPS_ALERT_EMAIL;
    const { sendOpsAlert } = await import("../ops-alerts");

    await sendOpsAlert({
      event: "test",
      rentalId: "rental-1",
      message: "test",
      sendEmailAlert: true,
    });

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does NOT throw if email sending fails (graceful degradation)", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@test.com";
    mockSendEmail.mockRejectedValue(new Error("SMTP error"));
    const { sendOpsAlert } = await import("../ops-alerts");

    // Should not throw — sendOpsAlert uses .catch() internally
    await expect(
      sendOpsAlert({
        event: "test",
        rentalId: "rental-1",
        message: "test",
        sendEmailAlert: true,
      }),
    ).resolves.toBeUndefined();

    delete process.env.OPS_ALERT_EMAIL;
  });

  it("logs email failure when email sending fails", async () => {
    process.env.OPS_ALERT_EMAIL = "ops@test.com";
    mockSendEmail.mockRejectedValue(new Error("SMTP error"));
    const { sendOpsAlert } = await import("../ops-alerts");

    await sendOpsAlert({
      event: "test",
      rentalId: "rental-1",
      message: "test",
      sendEmailAlert: true,
    });

    // Wait for the .catch() handler to execute
    await vi.waitFor(() => {
      expect(mockLoggerError).toHaveBeenCalledTimes(2);
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: "ops",
        event: "ops_email_failed",
      }),
      "Failed to send ops alert email",
    );

    delete process.env.OPS_ALERT_EMAIL;
  });
});
