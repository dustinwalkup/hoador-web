import { describe, it, expect } from "vitest";
import { formatAlertText } from "../format-alert-text";

describe("formatAlertText", () => {
  describe("not_started", () => {
    it("owner pickup — starts today", () => {
      expect(formatAlertText("not_started", "owner", false, 0)).toBe(
        "Rental starts today — mark it as started when the renter picks up the item",
      );
    });

    it("owner delivery — starts today", () => {
      expect(formatAlertText("not_started", "owner", true, 0)).toBe(
        "Rental starts today — mark it as started when you deliver the item",
      );
    });

    it("renter pickup — starts today", () => {
      expect(formatAlertText("not_started", "renter", false, 0)).toBe(
        "Your rental starts today — coordinate pickup with the owner",
      );
    });

    it("renter delivery — starts today", () => {
      expect(formatAlertText("not_started", "renter", true, 0)).toBe(
        "Your rental starts today — the owner will deliver the item to you",
      );
    });

    it("owner — missed start (daysLate > 0)", () => {
      expect(formatAlertText("not_started", "owner", false, 3)).toBe(
        "This rental should have started 3 days ago",
      );
      expect(formatAlertText("not_started", "owner", true, 1)).toBe(
        "This rental should have started 1 day ago",
      );
    });

    it("renter — missed start (daysLate > 0)", () => {
      expect(formatAlertText("not_started", "renter", false, 2)).toBe(
        "Your rental was due to start 2 days ago",
      );
    });
  });

  describe("end_today", () => {
    it("owner pickup", () => {
      expect(formatAlertText("end_today", "owner", false, 0)).toBe(
        "Rental ends today — click End Rental when the item is returned",
      );
    });

    it("owner delivery", () => {
      expect(formatAlertText("end_today", "owner", true, 0)).toBe(
        "Rental ends today — click End Rental when you pick up the item",
      );
    });

    it("renter pickup", () => {
      expect(formatAlertText("end_today", "renter", false, 0)).toBe(
        "Your rental ends today — return the item to the owner",
      );
    });

    it("renter delivery", () => {
      expect(formatAlertText("end_today", "renter", true, 0)).toBe(
        "Your rental ends today — the owner will come to collect the item",
      );
    });
  });

  describe("overdue_return", () => {
    it("owner pickup", () => {
      expect(formatAlertText("overdue_return", "owner", false, 4)).toBe(
        "Return is 4 days overdue — end the rental once the item is back",
      );
    });

    it("owner delivery", () => {
      expect(formatAlertText("overdue_return", "owner", true, 1)).toBe(
        "Return is 1 day overdue — end the rental once you collect the item",
      );
    });

    it("renter pickup", () => {
      expect(formatAlertText("overdue_return", "renter", false, 2)).toBe(
        "Your return is 2 days overdue — return the item to the owner",
      );
    });

    it("renter delivery", () => {
      expect(formatAlertText("overdue_return", "renter", true, 5)).toBe(
        "Your return is 5 days overdue — contact the owner to arrange collection",
      );
    });
  });

  describe("service_not_completed", () => {
    it("provider — scheduled today", () => {
      expect(
        formatAlertText("service_not_completed", "provider", false, 0),
      ).toBe("Service was today — mark it complete when finished");
    });

    it("client — scheduled today", () => {
      expect(formatAlertText("service_not_completed", "client", false, 0)).toBe(
        "Your service was today — contact your provider if there's an issue",
      );
    });

    it("provider — past days", () => {
      expect(
        formatAlertText("service_not_completed", "provider", false, 3),
      ).toBe("Service from 3 days ago hasn't been marked complete");
    });

    it("client — past days", () => {
      expect(formatAlertText("service_not_completed", "client", false, 1)).toBe(
        "Your service from 1 day ago hasn't been completed",
      );
    });
  });
});
