import { describe, it, expect, beforeEach } from "vitest";

import {
  consume,
  refund,
  __resetForTests,
  __peekForTests,
} from "../ai-rate-limit";

describe("ai-rate-limit", () => {
  beforeEach(() => {
    __resetForTests();
  });

  it("allows the first call and decrements remaining", () => {
    const result = consume("user-1");
    expect(result).toEqual({ allowed: true, remaining: 9 });
  });

  it("allows up to 10 consecutive consumes for the same user", () => {
    for (let i = 0; i < 10; i++) {
      const r = consume("user-1");
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(9 - i);
    }
  });

  it("denies the 11th call with remaining: 0", () => {
    for (let i = 0; i < 10; i++) consume("user-1");
    const eleventh = consume("user-1");
    expect(eleventh).toEqual({ allowed: false, remaining: 0 });
  });

  it("isolates buckets per user", () => {
    for (let i = 0; i < 10; i++) consume("user-a");
    // user-a is exhausted but user-b has full quota
    expect(consume("user-a").allowed).toBe(false);
    expect(consume("user-b").allowed).toBe(true);
  });

  it("refund returns a token so it can be re-consumed", () => {
    for (let i = 0; i < 10; i++) consume("user-1");
    expect(consume("user-1").allowed).toBe(false);
    refund("user-1");
    expect(consume("user-1").allowed).toBe(true);
  });

  it("refund is a no-op when no tokens have been consumed", () => {
    expect(() => refund("never-seen")).not.toThrow();
    expect(consume("never-seen").allowed).toBe(true);
  });

  it("expires tokens after the window passes", () => {
    let now = 0;
    const clock = () => now;
    // Burn quota at t=0.
    for (let i = 0; i < 10; i++) consume("user-1", { now: clock });
    expect(consume("user-1", { now: clock }).allowed).toBe(false);

    // Just before the hour rolls over — still denied.
    now = 60 * 60 * 1000 - 1;
    expect(consume("user-1", { now: clock }).allowed).toBe(false);

    // One ms past the window — original tokens are stale, full quota restored.
    now = 60 * 60 * 1000 + 1;
    expect(__peekForTests("user-1", { now: clock })).toBe(10);
    const r = consume("user-1", { now: clock });
    expect(r).toEqual({ allowed: true, remaining: 9 });
  });

  it("partial-window expiry: only stale timestamps are pruned", () => {
    let now = 0;
    const clock = () => now;
    // Five tokens at t=0.
    for (let i = 0; i < 5; i++) consume("user-1", { now: clock });
    // Five more at t=30 min.
    now = 30 * 60 * 1000;
    for (let i = 0; i < 5; i++) consume("user-1", { now: clock });

    // Bucket full — 11th rejected.
    expect(consume("user-1", { now: clock }).allowed).toBe(false);

    // At t=61 min only the first batch has expired; 5 tokens free, 5 still in window.
    now = 61 * 60 * 1000;
    expect(__peekForTests("user-1", { now: clock })).toBe(5);
    expect(consume("user-1", { now: clock }).allowed).toBe(true);
  });

  it("honors a custom limit/window for testing flexibility", () => {
    const opts = { limit: 2, windowMs: 1000 };
    expect(consume("u", opts).allowed).toBe(true);
    expect(consume("u", opts).allowed).toBe(true);
    expect(consume("u", opts).allowed).toBe(false);
  });
});
