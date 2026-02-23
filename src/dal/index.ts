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
import { PaymentDAL } from "./payment.dal";
import { DisputeDAL } from "./dispute.dal";
import { UserActivityDAL } from "./user-activity.dal";

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
export const paymentDAL = new PaymentDAL();
export const disputeDAL = new DisputeDAL();
export const userActivityDAL = new UserActivityDAL();
