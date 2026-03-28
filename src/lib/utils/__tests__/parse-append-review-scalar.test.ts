import { describe, it, expect } from "vitest";
import { parseAppendReviewScalar } from "../parse-append-review-scalar";

describe("parseAppendReviewScalar", () => {
  it("parses a single labeled chunk", () => {
    const input =
      "Rejection reason (2026-03-26T19:12:24.359Z): Service not HOA-related";

    const result = parseAppendReviewScalar(input);

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.label).toBe("Rejection reason");
    expect(result.chunks[0]?.timestamp).toBe("2026-03-26T19:12:24.359Z");
    expect(result.chunks[0]?.message).toBe("Service not HOA-related");
  });

  it("parses multiple chunks separated by ---", () => {
    const input =
      "Rejection reason (2026-03-26T19:12:24.359Z): First denial\n\n---\nRejection reason (2026-03-26T19:12:44.359Z): Second denial";

    const result = parseAppendReviewScalar(input);

    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0]?.message).toBe("First denial");
    expect(result.chunks[1]?.message).toBe("Second denial");
    expect(result.chunks[1]?.timestamp).toBe("2026-03-26T19:12:44.359Z");
  });

  it("splits using collapsed --- fallback", () => {
    const input =
      "Rejection reason (2026-03-26T19:12:24.359Z): First denial --- Rejection reason (2026-03-26T19:12:44.359Z): Second denial";

    const result = parseAppendReviewScalar(input);

    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0]?.message).toBe("First denial");
    expect(result.chunks[1]?.message).toBe("Second denial");
  });

  it("returns unmatched legacy text as a single chunk", () => {
    const input = "This is legacy free text";

    const result = parseAppendReviewScalar(input);

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.label).toBeUndefined();
    expect(result.chunks[0]?.timestamp).toBeUndefined();
    expect(result.chunks[0]?.message).toBe("This is legacy free text");
  });

  it("returns empty chunks for null input", () => {
    expect(parseAppendReviewScalar(null).chunks).toHaveLength(0);
  });

  it("returns empty chunks for undefined input", () => {
    expect(parseAppendReviewScalar(undefined).chunks).toHaveLength(0);
  });

  it("returns empty chunks for empty string", () => {
    expect(parseAppendReviewScalar("").chunks).toHaveLength(0);
  });

  it("returns empty chunks for whitespace-only string", () => {
    expect(parseAppendReviewScalar("   ").chunks).toHaveLength(0);
  });

  it("message body may contain parentheses without confusing the parser", () => {
    const input =
      "Rejection reason (2026-03-26T19:12:24.359Z): Must be (at least) 10 chars";

    const result = parseAppendReviewScalar(input);

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.label).toBe("Rejection reason");
    expect(result.chunks[0]?.message).toBe("Must be (at least) 10 chars");
  });

  it("message body may span multiple lines", () => {
    const input =
      "Rejection reason (2026-03-26T19:12:24.359Z): Line one\nLine two";

    const result = parseAppendReviewScalar(input);

    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.label).toBe("Rejection reason");
    expect(result.chunks[0]?.message).toBe("Line one\nLine two");
  });
});
