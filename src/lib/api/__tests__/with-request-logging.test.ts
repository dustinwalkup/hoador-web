import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const mockGetLogger = vi.fn(() => mockLog);
let capturedCtx: Record<string, unknown> | undefined;
// The wrapper mutates the live context after entering it, so keep a copy of
// what it looked like on entry.
let ctxAtEntry: Record<string, unknown> | undefined;
const mockRunWithRequestContext = vi.fn(
  (ctx: Record<string, unknown>, fn: () => unknown) => {
    capturedCtx = ctx;
    ctxAtEntry = { ...ctx };
    return fn();
  },
);
const mockGetRequestContext = vi.fn(() => capturedCtx);
const mockGenerateRequestId = vi.fn(() => "test-request-id");
const mockGetCurrentUserId = vi.fn().mockResolvedValue("user-123");
const mockGetClientIP = vi.fn().mockReturnValue("192.168.1.1");
const mockGetUserAgent = vi.fn().mockReturnValue("TestAgent/1.0");
const mockCaptureException = vi.fn();

vi.mock("@/lib/logger", () => ({
  getLogger: () => mockGetLogger(),
  getRequestContext: () => mockGetRequestContext(),
  runWithRequestContext: (ctx: Record<string, unknown>, fn: () => unknown) =>
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
    capturedCtx = undefined;
    ctxAtEntry = undefined;
    mockGetCurrentUserId.mockResolvedValue("user-123");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs request received and response sent with requestId", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRequestLogging(handler, route);

    const res = await wrapped(request);

    expect(ctxAtEntry).toEqual(
      expect.objectContaining({
        requestId: "test-request-id",
        // Resolved inside the context, not before it (PERF-03).
        userId: null,
        route,
      }),
    );
    expect(mockGetCurrentUserId).toHaveBeenCalledTimes(1);
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

  it("resolves the user inside the request context and records it there (PERF-03)", async () => {
    let userIdSeenByHandler: unknown;
    const handler = vi.fn().mockImplementation(async () => {
      userIdSeenByHandler = capturedCtx?.userId;
      return NextResponse.json({ ok: true });
    });
    mockGetCurrentUserId.mockImplementation(async () => {
      // The context must already exist, so getCurrentUser can seed ctx.user
      // for the handler's own auth check to reuse.
      expect(capturedCtx).toBeDefined();
      return "user-123";
    });
    const wrapped = withRequestLogging(handler, route);

    await wrapped(request);

    expect(capturedCtx?.userId).toBe("user-123");
    expect(userIdSeenByHandler).toBe("user-123");
  });

  it("leaves userId null when session resolution throws", async () => {
    mockGetCurrentUserId.mockRejectedValue(new Error("session store down"));
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withRequestLogging(handler, route);

    const res = await wrapped(request);

    expect(res.status).toBe(200);
    expect(capturedCtx?.userId).toBeNull();
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
