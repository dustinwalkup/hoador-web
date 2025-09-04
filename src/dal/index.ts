import { RentalDAL } from "./rentals.dal";
import { ReviewDAL } from "./review.dal";
import { UserDAL } from "./user.dal";
import { ListingDAL } from "./listing.dal";
import { MessagesDAL } from "./messages.dal";

// Create singleton instances
export const userDAL = new UserDAL();
export const reviewDAL = new ReviewDAL();
export const rentalDAL = new RentalDAL();
export const listingDAL = new ListingDAL();
export const messagesDAL = new MessagesDAL();
