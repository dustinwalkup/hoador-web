import { describe, it, expect } from "vitest";
import { validateFilingWindow } from "../dispute-creation-service";

describe("validateFilingWindow", () => {
  it("returnConfirmedAt set, within 24h → valid", () => {
    const returnConfirmedAt = new Date("2024-01-10T12:00:00Z");
    const now = new Date("2024-01-10T18:00:00Z"); // 6h later

    const result = validateFilingWindow(
      new Date("2024-01-01"),
      returnConfirmedAt,
      now,
    );

    expect(result).toEqual({ valid: true });
  });

  it("returnConfirmedAt set, exactly 24h → boundary (valid)", () => {
    const returnConfirmedAt = new Date("2024-01-10T12:00:00Z");
    const now = new Date("2024-01-11T12:00:00Z"); // exactly 24h later

    const result = validateFilingWindow(
      new Date("2024-01-01"),
      returnConfirmedAt,
      now,
    );

    expect(result).toEqual({ valid: true });
  });

  it("returnConfirmedAt set, 24h01m → invalid", () => {
    const returnConfirmedAt = new Date("2024-01-10T12:00:00Z");
    const now = new Date("2024-01-11T12:01:00Z"); // 24h 1m later

    const result = validateFilingWindow(
      new Date("2024-01-01"),
      returnConfirmedAt,
      now,
    );

    expect(result.valid).toBe(false);
    expect(result).toHaveProperty("message");
    expect((result as { valid: false; message: string }).message).toContain(
      "24 hours after the return was confirmed",
    );
  });

  it("returnConfirmedAt not set, now >= startDate → valid", () => {
    const startDate = new Date("2024-01-01T00:00:00Z");
    const now = new Date("2024-01-05T12:00:00Z");

    const result = validateFilingWindow(startDate, null, now);

    expect(result).toEqual({ valid: true });
  });

  it("returnConfirmedAt not set, now < startDate → invalid", () => {
    const startDate = new Date("2024-01-10T00:00:00Z");
    const now = new Date("2024-01-05T12:00:00Z");

    const result = validateFilingWindow(startDate, null, now);

    expect(result.valid).toBe(false);
    expect(result).toHaveProperty("message");
    expect((result as { valid: false; message: string }).message).toContain(
      "before the rental start date",
    );
  });
});
