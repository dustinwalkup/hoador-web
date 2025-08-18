import { RentalDAL } from "./rentals.dal";
import { ReviewDAL } from "./review.dal";
import { ToolDAL } from "./tool.dal";
import { UserDAL } from "./user.dal";
import { MessagesDAL } from "./messages.dal";

// Create singleton instances
export const userDAL = new UserDAL();
export const reviewDAL = new ReviewDAL();
export const rentalDAL = new RentalDAL();
export const toolDAL = new ToolDAL();
export const messagesDAL = new MessagesDAL();
