import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_TYPE_TO_CATEGORY,
  type NotificationType,
  type NotificationCategory,
} from "../notification-type-map";
import {
  notificationTypeEnum,
  notificationCategoryEnum,
} from "@/db/schemas/_enums";

describe("notification-type-map", () => {
  const allTypes = notificationTypeEnum.enumValues as NotificationType[];
  const allCategories =
    notificationCategoryEnum.enumValues as NotificationCategory[];

  it("maps every notification type to a category", () => {
    for (const type of allTypes) {
      const category = NOTIFICATION_TYPE_TO_CATEGORY[type];
      expect(category).toBeDefined();
      expect(allCategories).toContain(category);
    }
  });

  it("maps rental_* (except rental_reminder) to bookings", () => {
    const bookingTypes: NotificationType[] = [
      "rental_request_created",
      "rental_approved",
      "rental_denied",
      "rental_started",
      "rental_ended",
      "rental_cancelled",
      "rental_overdue",
    ];
    for (const type of bookingTypes) {
      expect(NOTIFICATION_TYPE_TO_CATEGORY[type]).toBe("bookings");
    }
  });

  it("maps rental_reminder to reminders", () => {
    expect(NOTIFICATION_TYPE_TO_CATEGORY.rental_reminder).toBe("reminders");
  });

  it("maps payment_* to payments", () => {
    expect(NOTIFICATION_TYPE_TO_CATEGORY.payment_succeeded).toBe("payments");
    expect(NOTIFICATION_TYPE_TO_CATEGORY.payment_failed).toBe("payments");
    expect(NOTIFICATION_TYPE_TO_CATEGORY.payment_refunded).toBe("payments");
  });

  it("maps message_received to messages", () => {
    expect(NOTIFICATION_TYPE_TO_CATEGORY.message_received).toBe("messages");
  });

  it("maps dispute_* to disputes", () => {
    expect(NOTIFICATION_TYPE_TO_CATEGORY.dispute_created).toBe("disputes");
    expect(NOTIFICATION_TYPE_TO_CATEGORY.dispute_evidence_requested).toBe(
      "disputes",
    );
    expect(
      NOTIFICATION_TYPE_TO_CATEGORY.dispute_evidence_deadline_approaching,
    ).toBe("disputes");
    expect(
      NOTIFICATION_TYPE_TO_CATEGORY.dispute_evidence_deadline_expired,
    ).toBe("disputes");
    expect(NOTIFICATION_TYPE_TO_CATEGORY.dispute_resolved).toBe("disputes");
  });

  it("maps listing_approved, listing_rejected, review_received, system to bookings", () => {
    expect(NOTIFICATION_TYPE_TO_CATEGORY.listing_approved).toBe("bookings");
    expect(NOTIFICATION_TYPE_TO_CATEGORY.listing_rejected).toBe("bookings");
    expect(NOTIFICATION_TYPE_TO_CATEGORY.review_received).toBe("bookings");
    expect(NOTIFICATION_TYPE_TO_CATEGORY.system).toBe("bookings");
  });
});
