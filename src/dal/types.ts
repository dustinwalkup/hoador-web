/* eslint-disable @typescript-eslint/no-explicit-any */

import { userAddresses, userPreferences, user } from "@/db/schemas/user.schema";

// Data Transfer Objects (DTOs)
export interface CreateUserDTO {
  id: string;
  name: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface CreateUserWithAddressDTO {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  profileImageUrl?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    unit?: string;
  };
}

export interface AddressData {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  unit?: string;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  profileImageUrl?: string;
  stripeCustomerId?: string;
  status?:
    | "pending_verification"
    | "incomplete_profile"
    | "active"
    | "inactive"
    | "suspended";
}

export interface CreateListingDTO {
  name: string;
  description: string;
  categoryId: string;
  brand?: string;
  model?: string;
  condition: string; // "excellent" | "good" | "fair" | "poor"
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  securityDeposit?: number;
  specifications?: Record<string, any>;
  instructions?: string;
  safetyNotes?: string;
  minimumRentalPeriod?: number;
  maximumRentalPeriod?: number;
  requiresPickup?: boolean;
  deliveryAvailable?: boolean;
  deliveryFee?: number;
  deliveryRadius?: number;
  setupAvailable?: boolean;
  setupFee?: number;
}

export interface UpdateListingDTO {
  name?: string;
  description?: string;
  categoryId?: string;
  brand?: string;
  model?: string;
  condition?: string;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  securityDeposit?: number;
  specifications?: Record<string, any>;
  instructions?: string;
  safetyNotes?: string;
  minimumRentalPeriod?: number;
  maximumRentalPeriod?: number;
  requiresPickup?: boolean;
  deliveryAvailable?: boolean;
  deliveryFee?: number;
  deliveryRadius?: number;
  setupAvailable?: boolean;
  setupFee?: number;
  status?: "available" | "rented" | "maintenance" | "inactive";
}

export interface CreateRentalRequestDTO {
  listingId: string;
  startDate: Date;
  endDate: Date;
  deliveryRequested?: boolean;
  deliveryAddress?: string;
  message?: string;
}

export interface ListingSearchFilters {
  query?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: {
    lat: number;
    lng: number;
    radius: number;
  };
  availability?: {
    startDate: Date;
    endDate: Date;
  };
  condition?: string[];
  deliveryAvailable?: boolean;
  setupAvailable?: boolean;
  sortBy?: "price" | "rating" | "distance" | "newest";
  sortOrder?: "asc" | "desc";
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

type UserDB = typeof user.$inferSelect;
type PreferencesDB = typeof userPreferences.$inferSelect;
type AddressDB = typeof userAddresses.$inferSelect;

export interface UserStats {
  listingsBorrowed: number;
  listingsShared: number;
  averageRating: number;
  totalReviews: number;
}

export interface UserProfile
  extends Omit<
    UserDB,
    | "passwordHash"
    | "twoFactorSecret"
    | "updatedAt"
    | "lastLoginAt"
    | "twoFactorEnabled"
  > {
  stats: UserStats;
  preferences: PreferencesDB | null;
  primaryAddress?: AddressDB;
}

export interface ListingDetails {
  id: string;
  name: string;
  description: string;
  brand?: string;
  model?: string;
  condition: string;
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  securityDeposit: number;
  status: string;
  specifications: Record<string, any>;
  instructions?: string;
  safetyNotes?: string;
  minimumRentalPeriod: number;
  maximumRentalPeriod: number;
  requiresPickup: boolean;
  deliveryAvailable: boolean;
  deliveryFee: number;
  deliveryRadius: number;
  setupAvailable: boolean;
  setupFee: number;
  viewCount: number;
  favoriteCount: number;
  averageRating: number;
  reviewCount: number;
  isFavorited?: boolean;
  createdAt: Date;
  updatedAt: Date;
  images: Array<{
    id: string;
    imageUrl: string;
    orderIndex: number;
  }>;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    averageRating: number;
    reviewCount: number;
    memberSince: Date;
  };
  category: {
    id: string;
    name: string;
    icon?: string;
  };
  reviews: Array<{
    id: string;
    rating: number;
    title?: string;
    comment?: string;
    createdAt: Date;
    reviewer: {
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl?: string;
    };
  }>;
  availability: Array<{
    id: string;
    startDate: Date;
    endDate: Date;
    isBlocked: boolean;
    reason?: string;
  }>;
}

export interface RentalDetails {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  totalAmount: number;
  securityDeposit: number;
  listing: {
    id: string;
    name: string;
    images: string[];
    dailyRate: number;
  };
  renter: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    phone?: string;
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    phone?: string;
  };
  payments: any[];
  reviews: any[];
  request?: any;
}

// Message types
export interface ConversationSummary {
  id: string;
  otherUser: {
    id: string;
    name: string;
    avatar: string | null;
    initials: string;
  };
  lastMessage: {
    content: string;
    time: Date;
    senderId: string;
  } | null;
  unread: boolean;
  lastMessageAt: Date | null;
  archived: boolean;
}

export interface ConversationDetails {
  id: string;
  otherUser: {
    id: string;
    name: string;
    avatar: string | null;
    initials: string;
  };
  messages: Array<{
    id: string;
    content: string;
    time: Date;
    sender: "me" | "them";
    senderName: string;
  }>;
  unread: boolean;
  archived: boolean;
}
