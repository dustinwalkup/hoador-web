import { pgEnum } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", [
  "pending_verification", // Email not verified (email signups only)
  "email_verified", // Email verified, but need community join code
  "incomplete_profile", // Has join code, but missing onboarding data
  "active", // Verified and onboarded - full access
  "inactive", // User deactivated their account
  "suspended", // Admin action - account suspended
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "denied",
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
  "denied",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "completed", // Keep for backward compatibility with existing payments table
  "failed",
  "refunded",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "rental_request_created",
  "rental_approved",
  "rental_denied",
  "rental_started",
  "rental_ended",
  "rental_cancelled",
  "rental_overdue",
  "rental_reminder",
  "payment_succeeded",
  "payment_failed",
  "payment_refunded",
  "review_received",
  "message_received",
  "system",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "sent",
  "delivered",
  "read",
]);

export const userTypeEnum = pgEnum("user_type", [
  "standard", // Regular user
  "admin", // Admin user with admin privileges
  "superadmin", // Super admin with full system access
]);
