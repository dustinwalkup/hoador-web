import { RentalDAL } from "./rentals.dal";
import { ReviewDAL } from "./review.dal";
import { UserDAL } from "./user.dal";

// Create singleton instances
export const userDAL = new UserDAL();
export const reviewDAL = new ReviewDAL();
export const rentalDAL = new RentalDAL();
