import { RentalDAL } from "./rentals.dal";
import { ReviewDAL } from "./review.dal";
import { UserDAL } from "./user.dal";
import { ListingDAL } from "./listing.dal";
import { MessagesDAL } from "./messages.dal";
import { CommunityDAL } from "./community.dal";
import {
  NotificationDAL,
  NotificationCategoryPreferencesDAL,
  PushSubscriptionDAL,
} from "./notifications.dal";
import { LegalDocumentDAL } from "./legal-document.dal";
import { RentalAgreementDocumentDAL } from "./rental-agreement-document.dal";
import { ServiceAgreementDocumentDAL } from "./service-agreement-document.dal";
import { PaymentDAL } from "./payment.dal";
import { DisputeDAL } from "./dispute.dal";
import { UserActivityDAL } from "./user-activity.dal";
import { AuditLogDAL } from "./audit-log.dal";
import { PaymentLifecycleDAL } from "./payment-lifecycle.dal";
import { CronRunHistoryDAL } from "./cron-run-history.dal";
import { ServiceListingDAL } from "./service-listing.dal";
import { ServiceBookingDAL } from "./service-booking.dal";
import { ServicePaymentLifecycleDAL } from "./service-payment-lifecycle.dal";
import { ServiceReviewDAL } from "./service-review.dal";
import { ReviewEventsDAL } from "./review-events.dal";

// Create singleton instances
export const userDAL = new UserDAL();
export const communityDAL = new CommunityDAL();
export const reviewDAL = new ReviewDAL();
export const rentalDAL = new RentalDAL();
export const listingDAL = new ListingDAL();
export const messagesDAL = new MessagesDAL();
export const notificationsDAL = new NotificationDAL();
export const notificationCategoryPreferencesDAL =
  new NotificationCategoryPreferencesDAL();
export const pushSubscriptionDAL = new PushSubscriptionDAL();
export const legalDocumentDAL = new LegalDocumentDAL();
export const rentalAgreementDocumentDAL = new RentalAgreementDocumentDAL();
export const serviceAgreementDocumentDAL = new ServiceAgreementDocumentDAL();
export const paymentDAL = new PaymentDAL();
export const disputeDAL = new DisputeDAL();
export const userActivityDAL = new UserActivityDAL();
export const auditLogDAL = new AuditLogDAL();
export const paymentLifecycleDAL = new PaymentLifecycleDAL();
export const cronRunHistoryDAL = new CronRunHistoryDAL();
export const serviceListingDAL = new ServiceListingDAL();
export const serviceBookingDAL = new ServiceBookingDAL();
export const servicePaymentLifecycleDAL = new ServicePaymentLifecycleDAL();
export const serviceReviewDAL = new ServiceReviewDAL();
export const reviewEventsDAL = new ReviewEventsDAL();
