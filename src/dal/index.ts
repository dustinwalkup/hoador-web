import { RentalDAL } from "./rentals.dal";
import { ReviewDAL } from "./review.dal";
import { UserDAL } from "./user.dal";
import { ListingDAL } from "./listing.dal";
import { MessagesDAL } from "./messages.dal";
import { CommunityDAL } from "./community.dal";
import { NotificationDAL } from "./notifications.dal";

// Create singleton instances
export const userDAL = new UserDAL();
export const communityDAL = new CommunityDAL();
export const reviewDAL = new ReviewDAL();
export const rentalDAL = new RentalDAL();
export const listingDAL = new ListingDAL();
export const messagesDAL = new MessagesDAL();
export const notificationsDAL = new NotificationDAL();

// Note: LegalDocumentDAL is not exported from here to avoid circular dependency.
// LegalDocumentDAL imports requireAuth from session.ts, which imports userDAL from this file.
// Import LegalDocumentDAL directly from "@/dal/legal-document.dal" instead.
