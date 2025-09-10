import { pgEnum } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", [
  "pending_verification", // Email not verified (email signups only)
  "incomplete_profile", // Verified but missing onboarding data
  "active", // Verified and onboarded - full access
  "inactive", // User deactivated their account
  "suspended", // Admin action - account suspended
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "rejected",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "available",
  "rented",
  "maintenance",
  "inactive",
]);

export const rentalStatusEnum = pgEnum("rental_status", [
  "pending",
  "approved",
  "active",
  "completed",
  "cancelled",
  "overdue",
  "rejected",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "rental_request",
  "rental_approved",
  "rental_reminder",
  "payment",
  "review",
  "system",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "sent",
  "delivered",
  "read",
]);
