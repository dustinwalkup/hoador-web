import { describe, it, expect } from "vitest";
import { formatReviewSummary } from "../reviews.utils";

describe("reviews.utils", () => {
  describe("formatReviewSummary", () => {
    it("should return 'No reviews yet' when count is 0", () => {
      expect(formatReviewSummary(4.5, 0)).toBe("No reviews yet");
      expect(formatReviewSummary(0, 0)).toBe("No reviews yet");
      expect(formatReviewSummary(5, 0)).toBe("No reviews yet");
    });

    it("should format single review correctly", () => {
      expect(formatReviewSummary(4.5, 1)).toBe("4.5 (1 review)");
      expect(formatReviewSummary(3.2, 1)).toBe("3.2 (1 review)");
      expect(formatReviewSummary(5, 1)).toBe("5 (1 review)");
      expect(formatReviewSummary(1.5, 1)).toBe("1.5 (1 review)");
    });

    it("should format multiple reviews correctly", () => {
      expect(formatReviewSummary(4.5, 2)).toBe("4.5 (2 reviews)");
      expect(formatReviewSummary(3.2, 10)).toBe("3.2 (10 reviews)");
      expect(formatReviewSummary(4.8, 100)).toBe("4.8 (100 reviews)");
      expect(formatReviewSummary(2.1, 5)).toBe("2.1 (5 reviews)");
    });

    it("should handle decimal averages correctly", () => {
      expect(formatReviewSummary(4.25, 4)).toBe("4.25 (4 reviews)");
      expect(formatReviewSummary(3.333, 3)).toBe("3.333 (3 reviews)");
      expect(formatReviewSummary(4.6667, 3)).toBe("4.6667 (3 reviews)");
    });

    it("should handle whole number averages correctly", () => {
      expect(formatReviewSummary(4, 5)).toBe("4 (5 reviews)");
      expect(formatReviewSummary(5, 10)).toBe("5 (10 reviews)");
      expect(formatReviewSummary(1, 2)).toBe("1 (2 reviews)");
    });

    it("should handle zero average with reviews", () => {
      expect(formatReviewSummary(0, 1)).toBe("0 (1 review)");
      expect(formatReviewSummary(0, 5)).toBe("0 (5 reviews)");
    });

    it("should handle large numbers correctly", () => {
      expect(formatReviewSummary(4.5, 1000)).toBe("4.5 (1000 reviews)");
      expect(formatReviewSummary(3.8, 9999)).toBe("3.8 (9999 reviews)");
      expect(formatReviewSummary(4.2, 1000000)).toBe("4.2 (1000000 reviews)");
    });

    it("should handle edge case of exactly 1 review", () => {
      expect(formatReviewSummary(4.5, 1)).toBe("4.5 (1 review)");
      expect(formatReviewSummary(0, 1)).toBe("0 (1 review)");
      expect(formatReviewSummary(5, 1)).toBe("5 (1 review)");
    });

    it("should handle edge case of exactly 2 reviews", () => {
      expect(formatReviewSummary(4.5, 2)).toBe("4.5 (2 reviews)");
      expect(formatReviewSummary(0, 2)).toBe("0 (2 reviews)");
      expect(formatReviewSummary(5, 2)).toBe("5 (2 reviews)");
    });

    it("should handle very small decimal averages", () => {
      expect(formatReviewSummary(0.1, 1)).toBe("0.1 (1 review)");
      expect(formatReviewSummary(0.01, 2)).toBe("0.01 (2 reviews)");
      expect(formatReviewSummary(0.001, 3)).toBe("0.001 (3 reviews)");
    });

    it("should handle very large decimal averages", () => {
      expect(formatReviewSummary(4.9999, 1)).toBe("4.9999 (1 review)");
      expect(formatReviewSummary(4.99999, 2)).toBe("4.99999 (2 reviews)");
    });

    it("should handle negative averages (edge case)", () => {
      // This might happen in some edge cases with data corruption
      expect(formatReviewSummary(-1, 1)).toBe("-1 (1 review)");
      expect(formatReviewSummary(-0.5, 2)).toBe("-0.5 (2 reviews)");
    });

    it("should handle very large counts", () => {
      expect(formatReviewSummary(4.5, Number.MAX_SAFE_INTEGER)).toBe(
        `4.5 (${Number.MAX_SAFE_INTEGER} reviews)`,
      );
    });

    it("should handle floating point precision issues", () => {
      // Test cases that might cause floating point precision issues
      expect(formatReviewSummary(1.1 + 2.2, 3)).toBe("3.3000000000000003 (3 reviews)");
      expect(formatReviewSummary(0.1 + 0.2, 2)).toBe("0.30000000000000004 (2 reviews)");
    });
  });
});
