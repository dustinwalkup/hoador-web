import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordFailedAuth } from "../failed-auth-store";

const mockWarn = vi.fn();
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ warn: mockWarn }),
}));

describe("failed-auth-store", () => {
  /** Use a unique identifier per test to avoid shared state across tests. */
  let testId: string;
  let idCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(10000);
    testId = `ident-${++idCounter}`;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("recordFailedAuth", () => {
    it("does not log when attempts are below threshold (default 5)", () => {
      for (let i = 0; i < 4; i++) {
        recordFailedAuth(testId);
      }
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it("logs a warning when attempt count reaches threshold (5th attempt)", () => {
      for (let i = 0; i < 5; i++) {
        recordFailedAuth(testId);
      }
      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockWarn).toHaveBeenCalledWith(
        {
          message: "auth.failed_threshold_exceeded",
          identifier: testId,
          count: 5,
          threshold: 5,
          windowMs: 15 * 60 * 1000,
        },
        "Repeated failed authentication attempts exceeded threshold",
      );
    });

    it("logs a warning on every attempt once threshold is exceeded", () => {
      for (let i = 0; i < 7; i++) {
        recordFailedAuth(testId);
      }
      expect(mockWarn).toHaveBeenCalledTimes(3); // 5th, 6th, 7th
    });

    it("tracks multiple identifiers independently", () => {
      const idA = `${testId}-A`;
      const idB = `${testId}-B`;

      for (let i = 0; i < 3; i++) recordFailedAuth(idA);
      for (let i = 0; i < 5; i++) recordFailedAuth(idB);

      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: idB, count: 5 }),
        expect.any(String),
      );
    });

    it("resets window after FAILED_AUTH_WINDOW_MS and does not log until threshold again", () => {
      const windowMs = 15 * 60 * 1000;

      for (let i = 0; i < 4; i++) recordFailedAuth(testId);
      expect(mockWarn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(windowMs + 1);

      recordFailedAuth(testId); // New window, count = 1
      expect(mockWarn).not.toHaveBeenCalled();

      for (let i = 0; i < 4; i++) recordFailedAuth(testId); // 2, 3, 4, 5
      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({ count: 5 }),
        expect.any(String),
      );
    });

    it("prunes old entries when recording a new attempt after window expired", () => {
      const windowMs = 15 * 60 * 1000;
      const oldId = `${testId}-old`;

      for (let i = 0; i < 5; i++) recordFailedAuth(oldId);
      expect(mockWarn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(windowMs + 1);

      recordFailedAuth(oldId); // Prunes old entry, starts new window with count 1
      expect(mockWarn).toHaveBeenCalledTimes(1); // No new warning (count is 1)
    });

    it("includes identifier in log payload", () => {
      const email = "user@example.com";
      for (let i = 0; i < 5; i++) recordFailedAuth(email);
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: email,
          message: "auth.failed_threshold_exceeded",
          threshold: 5,
          windowMs: 15 * 60 * 1000,
        }),
        "Repeated failed authentication attempts exceeded threshold",
      );
    });
  });
});
