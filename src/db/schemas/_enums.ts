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

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending_review",
  "approved",
  "rejected",
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
  "listing_approved",
  "listing_rejected",
  "system",
  "dispute_created",
  "dispute_evidence_requested",
  "dispute_evidence_deadline_approaching",
  "dispute_evidence_deadline_expired",
  "dispute_resolved",
  "re_engagement",
]);

/** User activity types for admin activity log and inactivity filtering. */
export const userActivityTypeEnum = pgEnum("user_activity_type", [
  "login",
  "logout",
  "password_change",
  "listing_created",
  "listing_updated",
  "listing_deleted",
  "listing_published",
  "rental_requested",
  "rental_approved",
  "rental_rejected",
  "rental_completed",
  "rental_cancelled",
  "profile_updated",
  "settings_updated",
  "payment_made",
  "payout_received",
  "review_created",
  "review_responded",
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

export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "evidence_requested",
  "under_review",
  "resolved",
  "closed",
]);

export const disputeReasonCodeEnum = pgEnum("dispute_reason_code", [
  "damage",
  "non_delivery",
  "quality_issue",
  "cancellation",
  "payment_issue",
  "other",
]);

export const disputeRoleEnum = pgEnum("dispute_role", ["renter", "provider"]);

export const disputeResolutionOutcomeEnum = pgEnum(
  "dispute_resolution_outcome",
  [
    "favor_renter",
    "favor_provider",
    "partial_renter",
    "partial_provider",
    "dismissed",
  ],
);

export const evidenceTypeEnum = pgEnum("evidence_type", ["image", "text"]);

export const auditActionTypeEnum = pgEnum("audit_action_type", [
  "dispute_created",
  "state_change",
  "evidence_uploaded",
  "evidence_deleted",
  "financial_operation",
  "note_created",
  "note_updated",
  "note_deleted",
  "resolution",
]);

export const financialOperationTypeEnum = pgEnum("financial_operation_type", [
  "hold_payout",
  "refund_partial",
  "refund_full",
  "capture_deposit",
]);

export const financialOperationStatusEnum = pgEnum(
  "financial_operation_status",
  ["pending", "succeeded", "failed"],
);

/** Notification category for preference toggles (email/push per category). */
export const notificationCategoryEnum = pgEnum("notification_category", [
  "bookings",
  "payments",
  "messages",
  "disputes",
  "reminders",
]);

/** Platform for push subscription (web vs native). */
export const pushSubscriptionPlatformEnum = pgEnum(
  "push_subscription_platform",
  ["web", "ios", "android"],
);

/** Deposit hold lifecycle status for rental_payment_lifecycle. */
export const depositHoldStatusEnum = pgEnum("deposit_hold_status", [
  "scheduled", // Hold scheduled, waiting for 48hrs-before-pickup cron
  "held", // Auth hold placed successfully
  "released", // Hold cancelled on clean return
  "expired", // Hold expired (>7 days) — detected by monitoring cron
  "release_failed", // Attempted release failed
  "failed", // Hold placement failed — awaiting renter payment method update
  "captured", // Hold captured for damage (Phase 3)
  "not_applicable", // No security deposit on this rental
]);

/** Owner transfer status for rental_payment_lifecycle. */
export const ownerTransferStatusEnum = pgEnum("owner_transfer_status", [
  "pending", // Awaiting transfer after dispute window
  "processing", // Transfer in progress
  "completed", // Transfer succeeded
  "failed", // Transfer failed — ops notified
  "frozen", // Frozen due to open dispute
]);

/** Payout status for rental_payment_lifecycle (concurrency lock). */
export const payoutStatusEnum = pgEnum("payout_status", [
  "pending", // Awaiting payout processing
  "processing", // Cron has claimed this rental — concurrency lock
  "completed", // All payout operations succeeded
  "failed", // One or more operations failed
]);

/** Payment type discriminator for the payments table. */
export const paymentTypeEnum = pgEnum("payment_type", [
  "rental_charge", // Main rental payment
  "security_deposit_hold", // Deposit auth hold
]);
