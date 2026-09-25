import { describe, it, expect, vi, afterEach } from "vitest";

const mockConsume = vi.fn();
vi.mock("@/dal", () => ({
  rateLimitDAL: {
    consume: (...a: unknown[]) => mockConsume(...a),
    getRaw: vi.fn(),
    setRaw: vi.fn(),
  },
}));

import { enforceRateLimit, betterAuthRateLimitStorage } from "../rate-limit";
import { RateLimitedError } from "@/dal/errors";

describe("enforceRateLimit (ARCH-07)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("in production", () => {
    it("resolves while the key is within its limit", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockConsume.mockResolvedValue({
        allowed: true,
        remaining: 2,
        retryAfterSeconds: 0,
      });

      await expect(enforceRateLimit("k", 3, 60)).resolves.toBeUndefined();
      expect(mockConsume).toHaveBeenCalledWith("k", 3, 60);
    });

    it("throws RateLimitedError carrying retryAfterSeconds once over", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockConsume.mockResolvedValue({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 42,
      });

      const error = await enforceRateLimit("k", 3, 60).catch((e) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as RateLimitedError).retryAfterSeconds).toBe(42);
      expect((error as RateLimitedError).statusCode).toBe(429);
    });
  });

  // Local dev and the Playwright suite share one localhost IP; per-IP limits
  // would trip them. Same gate as better-auth's own limiter.
  it("never touches the store outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");

    await enforceRateLimit("k", 0, 60);

    expect(mockConsume).not.toHaveBeenCalled();
  });
});

describe("betterAuthRateLimitStorage.consume", () => {
  afterEach(() => vi.clearAllMocks());

  it("maps an allowed hit to retryAfter: null", async () => {
    mockConsume.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });

    await expect(
      betterAuthRateLimitStorage.consume!("ba-key", { window: 10, max: 5 }),
    ).resolves.toEqual({ allowed: true, retryAfter: null });
    // better-auth's `window` is seconds and `max` the limit.
    expect(mockConsume).toHaveBeenCalledWith("ba-key", 5, 10);
  });

  it("maps a refused hit to its retryAfter seconds", async () => {
    mockConsume.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 7,
    });

    await expect(
      betterAuthRateLimitStorage.consume!("ba-key", { window: 10, max: 5 }),
    ).resolves.toEqual({ allowed: false, retryAfter: 7 });
  });
});
