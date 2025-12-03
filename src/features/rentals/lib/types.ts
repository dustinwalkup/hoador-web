export type RentalStatus =
  | "pending"
  | "approved"
  | "active"
  | "completed"
  | "cancelled"
  | "overdue"
  | "denied";

export type RentalType = "renting" | "lending";

export interface Listing {
  id: string;
  name: string;
  imageUrl: string;
}

export interface User {
  id?: string;
  name: string;
  profileImage: string;
  rating?: number;
  reviewCount?: number;
  verified?: boolean;
}

export interface BaseRental {
  id: string;
  listing: Listing;
  startDate: string;
  endDate: string;
  totalAmount: number;
  status: RentalStatus;
  createdAt?: string;
}

export interface RentingRental extends BaseRental {
  owner: User;
  deliveryRequested?: boolean;
  setupRequested?: boolean;
  actualStartDate?: string;
  actualEndDate?: string;
  pickupInstructions?: string;
  reviewGiven?: boolean;
  canLeaveReview?: boolean;
  deniedAt?: string;
  denialReason?: string;
}

export interface LendingRental extends BaseRental {
  renter: User;
  totalDays: number;
  dailyRate: number;
  securityDeposit: number;
  deliveryRequested: boolean;
  setupRequested?: boolean;
  deliveryAddress?: string;
  deliveryFee?: number;
  setupFee?: number;
  message?: string;
  approvedAt?: string;
  completedAt?: string;
  deniedAt?: string;
  denialReason?: string;
  selectedWindow?: string;
}

export type RentalItem = RentingRental | LendingRental;

// Types that match the DAL output structure
export interface BorrowedListing {
  id: string;
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  ownerId: string;
  ownerName: string;
  startDate: Date;
  endDate: Date;
  totalAmount: string;
  status: string;
  dailyRate: string;
  canLeaveReview?: boolean;
}

export interface BorrowedListingsData {
  currentRentals: BorrowedListing[];
  upcomingRentals: BorrowedListing[];
}

// Re-export from DAL for convenience
export type {
  RentalRequestItem,
  LendingRequestItem,
} from "../../../dal/rentals.dal";

export interface RentalsData {
  renting: {
    requests: RentingRental[];
    active: RentingRental[];
    completed: RentingRental[];
    denied: RentingRental[];
  };
  lending: {
    incoming: LendingRental[];
    active: LendingRental[];
    completed: LendingRental[];
    denied: LendingRental[];
  };
}
