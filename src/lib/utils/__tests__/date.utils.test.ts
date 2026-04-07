import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  differenceInDays,
  formatMMMd,
  formatPPP,
  formatDistanceToNow,
  formatDate,
  formatLocalDate,
} from "../date.utils";

describe("date.utils", () => {
  // Mock Date.now() to have consistent test results
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("differenceInDays", () => {
    it("should calculate the difference between two dates correctly", () => {
      // Use noon UTC to avoid timezone boundary issues
      const date1 = new Date("2024-01-10T12:00:00Z");
      const date2 = new Date("2024-01-05T12:00:00Z");
      expect(differenceInDays(date1, date2)).toBe(5);
    });

    it("should return the absolute difference (always positive)", () => {
      const date1 = new Date("2024-01-05T12:00:00Z");
      const date2 = new Date("2024-01-10T12:00:00Z");
      expect(differenceInDays(date1, date2)).toBe(5);
    });

    it("should handle string dates", () => {
      expect(
        differenceInDays("2024-01-10T12:00:00Z", "2024-01-05T12:00:00Z"),
      ).toBe(5);
    });

    it("should handle number timestamps", () => {
      const date1 = new Date("2024-01-10T12:00:00Z").getTime();
      const date2 = new Date("2024-01-05T12:00:00Z").getTime();
      expect(differenceInDays(date1, date2)).toBe(5);
    });

    it("should return 0 for the same date", () => {
      const date = new Date("2024-01-10T12:00:00Z");
      expect(differenceInDays(date, date)).toBe(0);
    });

    it("should handle dates across different months", () => {
      const date1 = new Date("2024-02-01T12:00:00Z");
      const date2 = new Date("2024-01-15T12:00:00Z");
      expect(differenceInDays(date1, date2)).toBe(17);
    });

    it("should handle dates across different years", () => {
      const date1 = new Date("2024-01-01T12:00:00Z");
      const date2 = new Date("2023-12-15T12:00:00Z");
      expect(differenceInDays(date1, date2)).toBe(17);
    });
  });

  describe("formatMMMd", () => {
    it("should format date in MMM d pattern", () => {
      // Use noon UTC to avoid timezone boundary issues
      const date = new Date("2024-01-05T12:00:00Z");
      expect(formatMMMd(date)).toBe("Jan 5");
    });

    it("should handle string dates", () => {
      expect(formatMMMd("2024-03-15T12:00:00Z")).toBe("Mar 15");
    });

    it("should handle number timestamps", () => {
      const timestamp = new Date("2024-12-25T12:00:00Z").getTime();
      expect(formatMMMd(timestamp)).toBe("Dec 25");
    });

    it("should handle different months correctly", () => {
      expect(formatMMMd("2024-02-29T12:00:00Z")).toBe("Feb 29"); // Leap year
      expect(formatMMMd("2024-06-01T12:00:00Z")).toBe("Jun 1");
      expect(formatMMMd("2024-12-31T12:00:00Z")).toBe("Dec 31");
    });

    it("should handle single digit days", () => {
      expect(formatMMMd("2024-01-01T12:00:00Z")).toBe("Jan 1");
      expect(formatMMMd("2024-01-09T12:00:00Z")).toBe("Jan 9");
    });
  });

  describe("formatPPP", () => {
    it("should format date in long format", () => {
      // Use noon UTC to avoid timezone boundary issues
      const date = new Date("2024-01-05T12:00:00Z");
      expect(formatPPP(date)).toBe("January 5, 2024");
    });

    it("should handle string dates", () => {
      expect(formatPPP("2024-03-15T12:00:00Z")).toBe("March 15, 2024");
    });

    it("should handle number timestamps", () => {
      const timestamp = new Date("2024-12-25T12:00:00Z").getTime();
      expect(formatPPP(timestamp)).toBe("December 25, 2024");
    });

    it("should handle different months correctly", () => {
      expect(formatPPP("2024-02-29T12:00:00Z")).toBe("February 29, 2024"); // Leap year
      expect(formatPPP("2024-06-01T12:00:00Z")).toBe("June 1, 2024");
      expect(formatPPP("2024-12-31T12:00:00Z")).toBe("December 31, 2024");
    });

    it("should handle different years", () => {
      expect(formatPPP("2023-01-01T12:00:00Z")).toBe("January 1, 2023");
      expect(formatPPP("2025-12-31T12:00:00Z")).toBe("December 31, 2025");
    });
  });

  describe("formatDistanceToNow", () => {
    it("should format seconds correctly", () => {
      const pastDate = new Date("2024-01-15T11:59:30Z"); // 30 seconds ago
      expect(formatDistanceToNow(pastDate)).toBe("30 seconds");
    });

    it("should format minutes correctly", () => {
      const pastDate = new Date("2024-01-15T11:30:00Z"); // 30 minutes ago
      expect(formatDistanceToNow(pastDate)).toBe("30 minutes");
    });

    it("should format hours correctly", () => {
      const pastDate = new Date("2024-01-15T09:00:00Z"); // 3 hours ago
      expect(formatDistanceToNow(pastDate)).toBe("3 hours");
    });

    it("should format days correctly", () => {
      const pastDate = new Date("2024-01-10T12:00:00Z"); // 5 days ago
      expect(formatDistanceToNow(pastDate)).toBe("5 days");
    });

    it("should format months correctly", () => {
      const pastDate = new Date("2023-11-15T12:00:00Z"); // 2 months ago
      expect(formatDistanceToNow(pastDate)).toBe("2 months");
    });

    it("should format years correctly", () => {
      const pastDate = new Date("2022-01-15T12:00:00Z"); // 2 years ago
      expect(formatDistanceToNow(pastDate)).toBe("2 years");
    });

    it("should handle singular forms correctly", () => {
      const pastDate = new Date("2024-01-15T11:59:00Z"); // 1 minute ago
      expect(formatDistanceToNow(pastDate)).toBe("1 minute");
    });

    it("should add suffix when addSuffix option is true", () => {
      const pastDate = new Date("2024-01-15T11:30:00Z"); // 30 minutes ago
      expect(formatDistanceToNow(pastDate, { addSuffix: true })).toBe(
        "30 minutes ago",
      );
    });

    it("should not add suffix when addSuffix option is false", () => {
      const pastDate = new Date("2024-01-15T11:30:00Z"); // 30 minutes ago
      expect(formatDistanceToNow(pastDate, { addSuffix: false })).toBe(
        "30 minutes",
      );
    });

    it("should handle string dates", () => {
      const pastDate = "2024-01-15T11:30:00Z";
      expect(formatDistanceToNow(pastDate)).toBe("30 minutes");
    });

    it("should handle number timestamps", () => {
      const pastDate = new Date("2024-01-15T11:30:00Z").getTime();
      expect(formatDistanceToNow(pastDate)).toBe("30 minutes");
    });

    it("should handle very recent dates (less than 1 second)", () => {
      const pastDate = new Date("2024-01-15T11:59:59Z"); // 1 second ago
      expect(formatDistanceToNow(pastDate)).toBe("1 second");
    });

    it("should handle edge case of exactly 1 minute", () => {
      const pastDate = new Date("2024-01-15T11:59:00Z"); // exactly 1 minute ago
      expect(formatDistanceToNow(pastDate)).toBe("1 minute");
    });

    it("should handle edge case of exactly 1 hour", () => {
      const pastDate = new Date("2024-01-15T11:00:00Z"); // exactly 1 hour ago
      expect(formatDistanceToNow(pastDate)).toBe("1 hour");
    });

    it("should handle edge case of exactly 1 day", () => {
      const pastDate = new Date("2024-01-14T12:00:00Z"); // exactly 1 day ago
      expect(formatDistanceToNow(pastDate)).toBe("1 day");
    });
  });

  describe("formatDate", () => {
    it("should format with MMM d pattern", () => {
      // Use noon UTC to avoid timezone boundary issues
      const date = new Date("2024-01-05T12:00:00Z");
      expect(formatDate(date, "MMM d")).toBe("Jan 5");
    });

    it("should format with PPP pattern", () => {
      // Use noon UTC to avoid timezone boundary issues
      const date = new Date("2024-01-05T12:00:00Z");
      expect(formatDate(date, "PPP")).toBe("January 5, 2024");
    });

    it("should use default locale string when no pattern provided", () => {
      // Use noon UTC to avoid timezone boundary issues
      const date = new Date("2024-01-05T12:00:00Z");
      const result = formatDate(date);
      expect(result).toBe("1/5/2024"); // Default US locale format
    });

    it("should handle string dates with patterns", () => {
      expect(formatDate("2024-03-15T12:00:00Z", "MMM d")).toBe("Mar 15");
      expect(formatDate("2024-03-15T12:00:00Z", "PPP")).toBe("March 15, 2024");
    });

    it("should handle number timestamps with patterns", () => {
      const timestamp = new Date("2024-12-25T12:00:00Z").getTime();
      expect(formatDate(timestamp, "MMM d")).toBe("Dec 25");
      expect(formatDate(timestamp, "PPP")).toBe("December 25, 2024");
    });

    it("should handle undefined pattern", () => {
      // Use noon UTC to avoid timezone boundary issues
      const date = new Date("2024-01-05T12:00:00Z");
      const result = formatDate(date, undefined);
      expect(result).toBe("1/5/2024"); // Default US locale format
    });
  });

  describe("formatLocalDate", () => {
    it("should format a date-only string with weekday", () => {
      expect(formatLocalDate("2026-04-07")).toBe("Tuesday, April 7, 2026");
    });

    it("should not shift the date due to UTC midnight offset", () => {
      // This is the core bug fix: "2026-04-07" must not display as April 6
      expect(formatLocalDate("2026-04-07")).toContain("April 7");
    });

    it("should format the first of the month", () => {
      expect(formatLocalDate("2024-01-01")).toBe("Monday, January 1, 2024");
    });

    it("should format the last day of the year", () => {
      expect(formatLocalDate("2024-12-31")).toBe("Tuesday, December 31, 2024");
    });

    it("should handle leap day", () => {
      expect(formatLocalDate("2024-02-29")).toBe("Thursday, February 29, 2024");
    });

    it("should handle single-digit day", () => {
      expect(formatLocalDate("2024-06-05")).toBe("Wednesday, June 5, 2024");
    });
  });

  describe("edge cases and error handling", () => {
    it("should throw errors for invalid date strings", () => {
      // Invalid date strings should create Invalid Date objects
      const invalidDate = new Date("invalid-date");
      expect(isNaN(invalidDate.getTime())).toBe(true);

      // formatMMMd and formatPPP use Intl.DateTimeFormat which throws for invalid dates
      expect(() => formatMMMd(invalidDate)).toThrow();
      expect(() => formatPPP(invalidDate)).toThrow();

      // formatDistanceToNow doesn't throw, it just returns a weird result
      expect(() => formatDistanceToNow(invalidDate)).not.toThrow();
    });

    it("should handle very large numbers as timestamps", () => {
      const largeTimestamp = 9999999999999; // Far future date
      expect(() => formatMMMd(largeTimestamp)).not.toThrow();
      expect(() => formatPPP(largeTimestamp)).not.toThrow();
    });

    it("should handle negative timestamps", () => {
      const negativeTimestamp = -1000000000; // Past date
      expect(() => formatMMMd(negativeTimestamp)).not.toThrow();
      expect(() => formatPPP(negativeTimestamp)).not.toThrow();
    });
  });
});
