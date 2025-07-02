/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  userAddresses,
  userPreferences,
  users,
} from "@/db/schemas/users.schema";

// Data Transfer Objects (DTOs)
export interface CreateUserDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  profileImageUrl?: string;
}

export interface CreateToolDTO {
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
}

export interface UpdateToolDTO {
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
  status?: "available" | "rented" | "maintenance" | "inactive";
}

export interface CreateRentalRequestDTO {
  toolId: string;
  startDate: Date;
  endDate: Date;
  deliveryRequested?: boolean;
  deliveryAddress?: string;
  message?: string;
}

export interface ToolSearchFilters {
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

type UserDB = typeof users.$inferSelect;
type PreferencesDB = typeof userPreferences.$inferSelect;
type AddressDB = typeof userAddresses.$inferSelect;

export interface UserStats {
  toolsBorrowed: number;
  toolsShared: number;
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

export interface ToolDetails {
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
  tool: {
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
