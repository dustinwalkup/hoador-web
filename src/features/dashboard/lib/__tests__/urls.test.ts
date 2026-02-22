import { describe, it, expect } from "vitest";
import { getLendingRequestDetailUrl } from "../urls";

describe("getLendingRequestDetailUrl", () => {
  it("should return correct path for a given rental request id", () => {
    const requestId = "req-abc-123";
    const url = getLendingRequestDetailUrl(requestId);
    expect(url).toBe("/dashboard/rental/req-abc-123?view=lending");
  });

  it("should include view=lending query for lending view", () => {
    const url = getLendingRequestDetailUrl("xyz");
    expect(url).toContain("view=lending");
    expect(url).toBe("/dashboard/rental/xyz?view=lending");
  });
});
