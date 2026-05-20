import { describe, it, expect } from "vitest";
import { validateReturnTo } from "../return-to";

describe("validateReturnTo", () => {
  describe("rejects unsafe input", () => {
    it("rejects null", () => {
      expect(validateReturnTo(null)).toBeNull();
    });

    it("rejects undefined", () => {
      expect(validateReturnTo(undefined)).toBeNull();
    });

    it("rejects non-string values", () => {
      expect(validateReturnTo(123)).toBeNull();
      expect(validateReturnTo({})).toBeNull();
      expect(validateReturnTo([])).toBeNull();
    });

    it("rejects empty string", () => {
      expect(validateReturnTo("")).toBeNull();
    });

    it("rejects absolute URLs", () => {
      expect(validateReturnTo("https://evil.com")).toBeNull();
      expect(
        validateReturnTo("http://evil.com/dashboard/rentals/1"),
      ).toBeNull();
    });

    it("rejects protocol-relative URLs that could spoof another host", () => {
      expect(validateReturnTo("//evil.com")).toBeNull();
      expect(validateReturnTo("//evil.com/dashboard/rentals/1")).toBeNull();
    });

    it("rejects relative paths outside /dashboard/", () => {
      expect(validateReturnTo("/login")).toBeNull();
      expect(validateReturnTo("/admin")).toBeNull();
      expect(validateReturnTo("/api/internal/secret")).toBeNull();
    });

    it("rejects bare /dashboard with no trailing path", () => {
      expect(validateReturnTo("/dashboard")).toBeNull();
      // /dashboard/ followed by nothing should also reject — we want a real path.
      expect(validateReturnTo("/dashboard/")).toBeNull();
    });
  });

  describe("accepts safe dashboard paths", () => {
    it("accepts /dashboard/rentals/[id]", () => {
      expect(validateReturnTo("/dashboard/rentals/abc-123")).toBe(
        "/dashboard/rentals/abc-123",
      );
    });

    it("accepts /dashboard/(rentals)/rental/[id]", () => {
      const url = "/dashboard/rental/req-456";
      expect(validateReturnTo(url)).toBe(url);
    });

    it("accepts paths with query strings", () => {
      const url = "/dashboard/rentals/abc?view=detail";
      expect(validateReturnTo(url)).toBe(url);
    });

    it("accepts deeper paths under /dashboard/", () => {
      expect(validateReturnTo("/dashboard/services/bookings/x-1")).toBe(
        "/dashboard/services/bookings/x-1",
      );
    });
  });
});
