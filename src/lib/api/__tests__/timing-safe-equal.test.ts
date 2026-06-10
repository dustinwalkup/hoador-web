import { describe, it, expect } from "vitest";
import { timingSafeEqualStrings } from "../timing-safe-equal";

describe("timingSafeEqualStrings", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqualStrings("secret-value", "secret-value")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeEqualStrings("secret-value", "secret-walue")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeEqualStrings("short", "much-longer-secret")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(timingSafeEqualStrings("", "")).toBe(true);
  });
});
