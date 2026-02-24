import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const mockGetLogger = vi.fn(() => mockLog);
const mockRunWithRequestContext = vi.fn((_ctx: unknown, fn: () => unknown) =>
  fn(),
);
const mockGenerateRequestId = vi.fn(() => "test-request-id");
const mockGetCurrentUserId = vi.fn().mockResolvedValue("user-123");
const mockGetClientIP = vi.fn().mockReturnValue("192.168.1.1");
const mockGetUserAgent = vi.fn().mockReturnValue("TestAgent/1.0");
const mockCaptureException = vi.fn();

vi.mock("@/lib/logger", () => ({
  getLogger: () => mockGetLogger(),
  runWithRequestContext: (ctx: unknown, fn: () => unknown) =>
    mockRunWithRequestContext(ctx, fn),
  generateRequestId: () => mockGenerateRequestId(),
}));
vi.mock("@/lib/utils/request-context", () => ({
  getClientIP: (req: NextRequest) => mockGetClientIP(req),
  getUserAgent: (req: NextRequest) => mockGetUserAgent(req),
}));
vi.mock("@/features/auth/utils/session", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: (err: unknown, opts?: unknown) =>
    mockCaptureException(err, opts),
}));

import { withRequestLogging } from "../with-request-logging";

describe("withRequestLogging", () => {
  const route = "GET /api/test";
  const request = new NextRequest("http://localhost/api/test", {
    method: "GET",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetCurrentUserId.mockResolvedValue("user-123");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs request received and response sent with requestId", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRequestLogging(handler, route);

    const res = await wrapped(request);

    expect(mockRunWithRequestContext).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "test-request-id",
        userId: "user-123",
        route,
      }),
      expect.any(Function),
    );
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", route }),
      "request received",
    );
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 200,
        durationMs: expect.any(Number),
        route,
      }),
      "response sent",
    );
    expect(res.status).toBe(200);
  });

  it("on handler throw, logs error and calls Sentry with requestId, userId, route, environment", async () => {
    const err = new Error("handler failed");
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withRequestLogging(handler, route);

    await expect(wrapped(request)).rejects.toThrow("handler failed");

    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({ err, route }),
      "request failed",
    );
    expect(mockCaptureException).toHaveBeenCalledWith(err, {
      tags: expect.objectContaining({
        requestId: "test-request-id",
        userId: "user-123",
        route,
        environment: expect.any(String),
      }),
    });
  });

  it("logs slow request warning when duration exceeds SLOW_REQUEST_MS", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      vi.advanceTimersByTime(1100);
      return NextResponse.json({ ok: true });
    });
    const wrapped = withRequestLogging(handler, route);

    await wrapped(request);

    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: expect.any(Number),
        route,
        method: "GET",
      }),
      "slow request",
    );
  });
});
