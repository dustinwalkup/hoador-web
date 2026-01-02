import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTimeAgo } from "../get-time-ago";

describe("getTimeAgo", () => {
  beforeEach(() => {
    // Mock Date.now() to have a fixed reference point
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("just now", () => {
    it("should return 'just now' for less than 60 seconds", () => {
      const date = new Date("2024-01-15T11:59:30Z"); // 30 seconds ago
      expect(getTimeAgo(date)).toBe("just now");
    });

    it("should return 'just now' for 0 seconds", () => {
      const date = new Date("2024-01-15T12:00:00Z"); // now
      expect(getTimeAgo(date)).toBe("just now");
    });

    it("should return 'just now' for 59 seconds", () => {
      const date = new Date("2024-01-15T11:59:01Z"); // 59 seconds ago
      expect(getTimeAgo(date)).toBe("just now");
    });
  });

  describe("minutes ago", () => {
    it("should return '1 minute ago' for 1 minute", () => {
      const date = new Date("2024-01-15T11:59:00Z"); // 1 minute ago
      expect(getTimeAgo(date)).toBe("1 minute ago");
    });

    it("should return '2 minutes ago' for 2 minutes", () => {
      const date = new Date("2024-01-15T11:58:00Z"); // 2 minutes ago
      expect(getTimeAgo(date)).toBe("2 minutes ago");
    });

    it("should return '59 minutes ago' for 59 minutes", () => {
      const date = new Date("2024-01-15T11:01:00Z"); // 59 minutes ago
      expect(getTimeAgo(date)).toBe("59 minutes ago");
    });

    it("should handle singular form correctly", () => {
      const date = new Date("2024-01-15T11:59:00Z"); // 1 minute ago
      const result = getTimeAgo(date);
      expect(result).toBe("1 minute ago");
      expect(result).not.toContain("minutes");
    });

    it("should handle plural form correctly", () => {
      const date = new Date("2024-01-15T11:58:00Z"); // 2 minutes ago
      const result = getTimeAgo(date);
      expect(result).toBe("2 minutes ago");
      expect(result).toContain("minutes");
    });
  });

  describe("hours ago", () => {
    it("should return '1 hour ago' for 1 hour", () => {
      const date = new Date("2024-01-15T11:00:00Z"); // 1 hour ago
      expect(getTimeAgo(date)).toBe("1 hour ago");
    });

    it("should return '2 hours ago' for 2 hours", () => {
      const date = new Date("2024-01-15T10:00:00Z"); // 2 hours ago
      expect(getTimeAgo(date)).toBe("2 hours ago");
    });

    it("should return '23 hours ago' for 23 hours", () => {
      const date = new Date("2024-01-14T13:00:00Z"); // 23 hours ago
      expect(getTimeAgo(date)).toBe("23 hours ago");
    });

    it("should handle singular form correctly", () => {
      const date = new Date("2024-01-15T11:00:00Z"); // 1 hour ago
      const result = getTimeAgo(date);
      expect(result).toBe("1 hour ago");
      expect(result).not.toContain("hours");
    });

    it("should handle plural form correctly", () => {
      const date = new Date("2024-01-15T10:00:00Z"); // 2 hours ago
      const result = getTimeAgo(date);
      expect(result).toBe("2 hours ago");
      expect(result).toContain("hours");
    });
  });

  describe("days ago", () => {
    it("should return '1 day ago' for 1 day", () => {
      const date = new Date("2024-01-14T12:00:00Z"); // 1 day ago
      expect(getTimeAgo(date)).toBe("1 day ago");
    });

    it("should return '2 days ago' for 2 days", () => {
      const date = new Date("2024-01-13T12:00:00Z"); // 2 days ago
      expect(getTimeAgo(date)).toBe("2 days ago");
    });

    it("should return '6 days ago' for 6 days", () => {
      const date = new Date("2024-01-09T12:00:00Z"); // 6 days ago
      expect(getTimeAgo(date)).toBe("6 days ago");
    });

    it("should handle singular form correctly", () => {
      const date = new Date("2024-01-14T12:00:00Z"); // 1 day ago
      const result = getTimeAgo(date);
      expect(result).toBe("1 day ago");
      expect(result).not.toContain("days");
    });

    it("should handle plural form correctly", () => {
      const date = new Date("2024-01-13T12:00:00Z"); // 2 days ago
      const result = getTimeAgo(date);
      expect(result).toBe("2 days ago");
      expect(result).toContain("days");
    });
  });

  describe("weeks ago", () => {
    it("should return '1 week ago' for 7 days", () => {
      const date = new Date("2024-01-08T12:00:00Z"); // 7 days ago
      expect(getTimeAgo(date)).toBe("1 week ago");
    });

    it("should return '2 weeks ago' for 14 days", () => {
      const date = new Date("2024-01-01T12:00:00Z"); // 14 days ago
      expect(getTimeAgo(date)).toBe("2 weeks ago");
    });

    it("should return '4 weeks ago' for 28 days", () => {
      const date = new Date("2023-12-18T12:00:00Z"); // 28 days ago
      expect(getTimeAgo(date)).toBe("4 weeks ago");
    });

    it("should handle singular form correctly", () => {
      const date = new Date("2024-01-08T12:00:00Z"); // 1 week ago
      const result = getTimeAgo(date);
      expect(result).toBe("1 week ago");
      expect(result).not.toContain("weeks");
    });

    it("should handle plural form correctly", () => {
      const date = new Date("2024-01-01T12:00:00Z"); // 2 weeks ago
      const result = getTimeAgo(date);
      expect(result).toBe("2 weeks ago");
      expect(result).toContain("weeks");
    });

    it("should handle very old dates (many weeks)", () => {
      const date = new Date("2023-11-01T12:00:00Z"); // ~10 weeks ago
      const result = getTimeAgo(date);
      expect(result).toBe("10 weeks ago");
    });
  });

  describe("edge cases", () => {
    it("should handle future dates (negative seconds)", () => {
      const date = new Date("2024-01-15T13:00:00Z"); // 1 hour in future
      const result = getTimeAgo(date);
      // Future dates will return "just now" since seconds will be negative
      // Math.floor of negative number will result in negative seconds
      // The function doesn't explicitly handle this, so it falls through to "just now"
      expect(result).toBe("just now");
    });

    it("should handle dates exactly at boundaries", () => {
      // Exactly 60 seconds (should be 1 minute)
      const date1 = new Date("2024-01-15T11:59:00Z");
      expect(getTimeAgo(date1)).toBe("1 minute ago");

      // Exactly 3600 seconds (should be 1 hour)
      const date2 = new Date("2024-01-15T11:00:00Z");
      expect(getTimeAgo(date2)).toBe("1 hour ago");

      // Exactly 86400 seconds (should be 1 day)
      const date3 = new Date("2024-01-14T12:00:00Z");
      expect(getTimeAgo(date3)).toBe("1 day ago");

      // Exactly 604800 seconds (should be 1 week)
      const date4 = new Date("2024-01-08T12:00:00Z");
      expect(getTimeAgo(date4)).toBe("1 week ago");
    });
  });
});
