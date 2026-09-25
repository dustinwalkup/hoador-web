import { describe, it, expect } from "vitest";
import { rateLimitDAL as dal } from "@/dal";

/**
 * ARCH-07 against a REAL Postgres: the decide-and-increment is one UPSERT, so
 * concurrent hits on one key cannot all read a stale count. A mocked `db`
 * cannot show this — only real row locking can.
 */
describe("RateLimitDAL.consume (real DB)", () => {
  it("admits exactly `limit` of N concurrent hits on one key", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => dal.consume("it:concurrent", 3, 60)),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    const refused = results.filter((r) => !r.allowed);
    expect(refused).toHaveLength(2);
    for (const r of refused) {
      expect(r.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(r.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it("keeps keys independent", async () => {
    await dal.consume("it:a", 1, 60);

    await expect(dal.consume("it:b", 1, 60)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("opens a fresh window once the old one elapses", async () => {
    await expect(dal.consume("it:window", 1, 1)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(dal.consume("it:window", 1, 1)).resolves.toMatchObject({
      allowed: false,
    });

    await new Promise((r) => setTimeout(r, 1100));

    await expect(dal.consume("it:window", 1, 1)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });
});
