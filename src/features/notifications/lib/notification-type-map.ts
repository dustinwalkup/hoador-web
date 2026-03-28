import {
  notificationTypeEnum,
  notificationCategoryEnum,
} from "@/db/schemas/_enums";

/** Notification type from the database enum. */
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

/** Notification category for preference toggles (email/push per category). */
export type NotificationCategory =
  (typeof notificationCategoryEnum.enumValues)[number];

/**
 * Maps each notification type to a preference category.
 * Used to determine which email/push preferences apply when sending a notification.
 * Requirements: 8.4
 */
export const NOTIFICATION_TYPE_TO_CATEGORY: Record<
  NotificationType,
  NotificationCategory
> = {
  // Bookings (rentals except reminder)
  rental_request_created: "bookings",
  rental_approved: "bookings",
  rental_denied: "bookings",
  rental_started: "bookings",
  rental_ended: "bookings",
  rental_cancelled: "bookings",
  rental_overdue: "bookings",
  // Reminders (pickup/return reminders)
  rental_reminder: "reminders",
  // Payments
  payment_succeeded: "payments",
  payment_failed: "payments",
  payment_refunded: "payments",
  // Messages
  message_received: "messages",
  // Disputes
  dispute_created: "disputes",
  dispute_evidence_requested: "disputes",
  dispute_evidence_deadline_approaching: "disputes",
  dispute_evidence_deadline_expired: "disputes",
  dispute_resolved: "disputes",
  // Fallback to bookings (listing/review/system)
  listing_approved: "bookings",
  listing_rejected: "bookings",
  review_received: "bookings",
  system: "bookings",
  re_engagement: "bookings",
  // HOA services marketplace
  service_booking_requested: "bookings",
  service_booking_accepted: "bookings",
  service_booking_declined: "bookings",
  service_booking_completed: "bookings",
  service_payout_sent: "payments",
  service_listing_approved: "bookings",
  service_listing_rejected: "bookings",
  service_listing_pending: "bookings",
  service_no_show_reported: "disputes",
};
