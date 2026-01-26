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
  deliveryMode?: "pickup_only" | "delivery_only" | "both_available";
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
  deliveryMode?: "pickup_only" | "delivery_only" | "both_available";
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
  setupRequested?: boolean;
  setupFee?: number;
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
  deliveryMode?: "pickup_only" | "delivery_only" | "both_available";
  setupAvailable?: boolean;
  availableNow?: boolean;
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

export interface UserProfile extends Omit<
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

export type AdminUserType = "admin" | "superadmin";

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
  deliveryMode: "pickup_only" | "delivery_only" | "both_available";
  deliveryFee: number;
  deliveryRadius: number;
  setupAvailable: boolean;
  setupFee: number;
  viewCount: number;
  favoriteCount: number;
  averageRating: number;
  reviewCount: number;
  isFavorited?: boolean;
  approvalStatus?: "pending_review" | "approved" | "rejected";
  rejectionReason?: string | null;
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
    address?: {
      city: string;
      state: string;
    };
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
    listingId?: string | null;
    listingName?: string | null;
  }>;
  unread: boolean;
  archived: boolean;
}

// Review-related types for listing approval workflow
export interface PendingReviewListing {
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
  deliveryFee: number;
  setupFee: number;
  category: {
    id: string;
    name: string;
    icon?: string;
  };
  images: Array<{
    id: string;
    imageUrl: string;
    orderIndex: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
    isVerified: boolean;
    createdAt: Date;
    otherListingsCount: number;
    rentalHistory: {
      totalRentals: number;
      averageRating: number;
    };
  };
}

export interface ReviewedListing extends PendingReviewListing {
  approvalStatus: "approved" | "rejected";
  rejectionReason?: string;
  reviewedBy: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
  } | null;
  reviewedAt: Date | null;
}

// Legal Document types
export interface CurrentDocumentVersion {
  id: string;
  version: string;
  url: string;
  publishedAt: Date;
}

export interface DocumentVersionsMap {
  [documentId: string]: CurrentDocumentVersion;
}

export interface LegalAcceptance {
  id: string;
  userId: string;
  documentId: string;
  version: string;
  rentalRequestId: string | null;
  listingId: string | null;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  method: string;
}

export interface DocumentVersion {
  id: string;
  version: string;
  url: string;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RentalPayment {
  id: string;
  rentalId: string;
  listingId: string;
  listingName: string;
  amount: string; // Decimal as string from database
  status:
    | "pending"
    | "processing"
    | "succeeded"
    | "completed"
    | "failed"
    | "refunded";
  paymentDate: Date;
  rentalStartDate: Date;
  rentalEndDate: Date;
}

// Dispute types
import type {
  disputeStatusEnum,
  disputeReasonCodeEnum,
  disputeRoleEnum,
  disputeResolutionOutcomeEnum,
  evidenceTypeEnum,
  auditActionTypeEnum,
  financialOperationTypeEnum,
  financialOperationStatusEnum,
} from "@/db/schemas/_enums";

export type DisputeStatus = (typeof disputeStatusEnum.enumValues)[number];
export type DisputeReasonCode =
  (typeof disputeReasonCodeEnum.enumValues)[number];
export type DisputeRole = (typeof disputeRoleEnum.enumValues)[number];
export type DisputeResolutionOutcome =
  (typeof disputeResolutionOutcomeEnum.enumValues)[number];
export type EvidenceType = (typeof evidenceTypeEnum.enumValues)[number];
export type AuditActionType = (typeof auditActionTypeEnum.enumValues)[number];
export type FinancialOperationType =
  (typeof financialOperationTypeEnum.enumValues)[number];
export type FinancialOperationStatus =
  (typeof financialOperationStatusEnum.enumValues)[number];

export interface CreateDisputeData {
  rentalId: string;
  createdBy: string;
  createdByRole: DisputeRole;
  reasonCode: DisputeReasonCode;
  description: string;
  policyVersion: string;
  evidenceDeadline?: Date;
}

export interface DisputeWithRelations {
  id: string;
  referenceNumber: number | null;
  rentalId: string;
  createdBy: string;
  createdByRole: DisputeRole;
  reasonCode: DisputeReasonCode;
  description: string;
  status: DisputeStatus;
  policyVersion: string;
  evidenceDeadline: Date | null;
  additionalEvidenceDeadline: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionOutcome: DisputeResolutionOutcome | null;
  resolutionReason: string | null;
  stripeChargebackId: string | null;
  createdAt: Date;
  updatedAt: Date;
  rental?: {
    id: string;
    requestId: string | null;
    listingId: string;
    renterId: string;
    ownerId: string;
    listing?: {
      name: string;
    };
  };
  createdByUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  resolvedByUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  evidence?: Array<{
    id: string;
    disputeId: string;
    uploadedBy: string;
    uploadedByRole: DisputeRole;
    evidenceType: EvidenceType;
    content: string;
    uploadedAt: Date;
  }>;
  auditLogs?: Array<{
    id: string;
    disputeId: string;
    actionType: AuditActionType;
    userId: string | null;
    previousState: DisputeStatus | null;
    newState: DisputeStatus | null;
    details: Record<string, unknown> | null;
    reason: string | null;
    createdAt: Date;
  }>;
  internalNotes?: Array<{
    id: string;
    disputeId: string;
    adminId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  financialOperations?: Array<{
    id: string;
    disputeId: string;
    operationType: FinancialOperationType;
    amount: string | null;
    stripeOperationId: string | null;
    stripePaymentIntentId: string | null;
    stripeTransferId: string | null;
    status: FinancialOperationStatus;
    errorMessage: string | null;
    performedBy: string;
    performedAt: Date;
  }>;
}

export interface GetUserDisputesOptions {
  role?: DisputeRole;
  status?: DisputeStatus;
  page?: number;
  limit?: number;
}

export interface GetAdminDisputesOptions {
  status?: DisputeStatus;
  reasonCode?: DisputeReasonCode;
  page?: number;
  limit?: number;
}

export interface RateLimitResult {
  monthlyCount: number;
  yearlyCount: number;
  withinLimits: boolean;
}

export interface TimeWindowValidationResult {
  valid: boolean;
  message?: string;
}

export interface EvidenceDeadlineResult {
  expired: boolean;
  deadline: Date | null;
  timeRemaining?: number; // milliseconds
}
