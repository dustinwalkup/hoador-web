export type RentalStatus =
  | "pending"
  | "approved"
  | "active"
  | "completed"
  | "cancelled"
  | "overdue"
  | "rejected";

export type RentalType = "renting" | "lending";

export interface Tool {
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
  tool: Tool;
  startDate: string;
  endDate: string;
  totalAmount: number;
  status: RentalStatus;
  createdAt?: string;
}

export interface RentingRental extends BaseRental {
  owner: User;
  deliveryRequested?: boolean;
  actualStartDate?: string;
  actualEndDate?: string;
  pickupInstructions?: string;
  reviewGiven?: boolean;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface LendingRental extends BaseRental {
  renter: User;
  totalDays: number;
  dailyRate: number;
  securityDeposit: number;
  deliveryRequested: boolean;
  deliveryAddress?: string;
  deliveryFee?: number;
  message?: string;
  approvedAt?: string;
  completedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  selectedWindow?: string;
}

export type RentalItem = RentingRental | LendingRental;

// Types that match the DAL output structure
export interface BorrowedTool {
  id: string;
  toolId: string;
  toolName: string;
  toolImageUrl: string | null;
  ownerId: string;
  ownerName: string;
  startDate: Date;
  endDate: Date;
  totalAmount: string;
  status: string;
  dailyRate: string;
}

export interface BorrowedToolsData {
  currentRentals: BorrowedTool[];
  upcomingRentals: BorrowedTool[];
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
    rejected: RentingRental[];
  };
  lending: {
    incoming: LendingRental[];
    active: LendingRental[];
    completed: LendingRental[];
    rejected: LendingRental[];
  };
}
