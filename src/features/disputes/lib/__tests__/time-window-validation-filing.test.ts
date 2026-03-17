import { describe, it, expect } from "vitest";
import { TimeWindowValidation } from "../time-window-validation";

describe("TimeWindowValidation.isDisputeFilingWindowOpen", () => {
  it("approved + past startDate → returns true (returnConfirmedAt null, now >= startDate)", () => {
    const startDate = new Date("2024-01-01T12:00:00Z");
    const now = new Date("2024-01-05T12:00:00Z");

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      null,
      now,
    );

    expect(result).toBe(true);
  });

  it("approved + before startDate → returns false (returnConfirmedAt null, now < startDate)", () => {
    const startDate = new Date("2024-01-10T12:00:00Z");
    const now = new Date("2024-01-05T12:00:00Z");

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      null,
      now,
    );

    expect(result).toBe(false);
  });

  it("active → returns true (no returnConfirmedAt, now >= startDate)", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const now = new Date("2024-01-03T12:00:00Z");

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      undefined,
      now,
    );

    expect(result).toBe(true);
  });

  it("completed + within 24h of returnConfirmedAt → returns true", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const returnConfirmedAt = new Date("2024-01-05T12:00:00Z");
    const now = new Date("2024-01-05T20:00:00Z"); // 8h after return

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      returnConfirmedAt,
      now,
    );

    expect(result).toBe(true);
  });

  it("completed + 25h after returnConfirmedAt → returns false", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const returnConfirmedAt = new Date("2024-01-05T12:00:00Z");
    const now = new Date("2024-01-06T13:00:00Z"); // 25h after return

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      returnConfirmedAt,
      now,
    );

    expect(result).toBe(false);
  });

  it("returnConfirmedAt null, now >= startDate → true", () => {
    const startDate = new Date("2024-06-01T00:00:00Z");
    const now = new Date("2024-06-02T00:00:00Z");

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      null,
      now,
    );

    expect(result).toBe(true);
  });

  it("returnConfirmedAt null, now < startDate → false", () => {
    const startDate = new Date("2024-06-15T00:00:00Z");
    const now = new Date("2024-06-01T00:00:00Z");

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      null,
      now,
    );

    expect(result).toBe(false);
  });

  it("exactly at 24h boundary (returnConfirmedAt set) → returns true (inclusive)", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const returnConfirmedAt = new Date("2024-01-05T00:00:00Z");
    const now = new Date("2024-01-06T00:00:00Z"); // exactly 24h later

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      returnConfirmedAt,
      now,
    );

    expect(result).toBe(true);
  });

  it("exactly at startDate boundary (no returnConfirmedAt) → returns true", () => {
    const startDate = new Date("2024-01-05T12:00:00Z");
    const now = new Date("2024-01-05T12:00:00Z");

    const result = TimeWindowValidation.isDisputeFilingWindowOpen(
      startDate,
      null,
      now,
    );

    expect(result).toBe(true);
  });
});
