import { eq, and, inArray, sql, gte, lte, lt, or, desc } from "drizzle-orm";
import { tryCatch } from "@walkup/walkup-utils";

import { rentals, rentalRequests, reviews } from "@/db/schemas/rentals.schema";
import {
  listings,
  listingImages,
  listingAvailability,
} from "@/db/schemas/listings.schema";
import { user, userAddresses } from "@/db/schemas/user.schema";
import { conversations } from "@/db/schemas/messages.schema";
import { differenceInDays } from "@/lib/utils/date.utils";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";
import { BaseDAL } from "./base";
import { NotFoundError } from "./errors";
import { ReviewDAL } from "./review.dal";

// Create a single instance at module level to reuse across methods
const reviewDALInstance = new ReviewDAL();

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
  conversationId?: string | null;
  canLeaveReview?: boolean;
}

export interface BorrowedListingsData {
  currentRentals: BorrowedListing[];
  upcomingRentals: BorrowedListing[];
}

export interface RentalRequestItem {
  id: string;
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  renterId: string;
  ownerId: string;
  ownerName: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  dailyRate: string;
  totalAmount: string;
  status: string;
  createdAt: Date;
  deliveryRequested: boolean;
  setupRequested?: boolean;
  setupFee?: string;
  message: string | null;
  deniedAt?: Date | null;
  denialReason?: string | null;
  approvedAt?: Date | null;
  conversationId?: string | null;
  canLeaveReview?: boolean;
}

export interface LendingRequestItem {
  id: string;
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  renterId: string;
  renterName: string;
  renterProfileImage?: string | null;
  renterRating?: number;
  renterReviewCount?: number;
  renterVerified?: boolean;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  dailyRate: string;
  totalAmount: string;
  securityDeposit: string;
  status: string;
  createdAt: Date;
  deliveryRequested: boolean;
  deliveryAddress: string | null;
  deliveryFee: string;
  setupRequested?: boolean;
  setupFee?: string;
  message: string | null;
  selectedWindow?: string | null;
  deniedAt?: Date | null;
  denialReason?: string | null;
  approvedAt?: Date | null;
  conversationId?: string | null;
}

/**
 * Payload for inserting a rental request. All pricing and business rules
 * are applied by the service layer; the DAL only persists.
 */
export interface InsertRentalRequestPayload {
  listingId: string;
  renterId: string;
  ownerId: string;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  dailyRate: string;
  totalAmount: string;
  securityDeposit: string;
  deliveryRequested: boolean;
  deliveryAddress: string | null;
  deliveryInstructions: string | null;
  deliveryFee: string;
  setupRequested: boolean;
  setupFee: string;
  serviceFee: string;
  applicationFeeAmount: string;
  ownerPayout: string;
  platformNetRevenue: string;
  message: string | null;
  paymentIntentId: string | null;
  paymentMethodId: string | null;
  status: "pending";
}

export interface RentalDetails {
  id: string;
  type: "request" | "rental";
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  listingBrand?: string;
  listingModel?: string;
  listingCondition?: string;
  listingDescription?: string;
  listingSpecifications?: Record<string, string>;
  renterId: string;
  renterName: string;
  renterEmail: string;
  renterPhone?: string;
  renterProfileImage?: string;
  renterRating?: number;
  renterReviewCount?: number;
  renterVerified?: boolean;
  renterMemberSince?: string;
  renterCompletedRentals?: number;
  renterResponseRate?: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ownerProfileImage?: string;
  ownerRating?: number;
  ownerReviewCount?: number;
  ownerVerified?: boolean;
  ownerMemberSince?: string;
  ownerListingsListed?: number;
  ownerResponseRate?: string;
  startDate: Date;
  endDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  totalDays: number;
  dailyRate: string;
  totalAmount: string;
  securityDeposit: string;
  deliveryRequested: boolean;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  deliveryFee: string;
  pickupAddress?: string;
  setupRequested?: boolean;
  setupFee?: string;
  serviceFee?: string;
  selectedWindow?: string;
  message?: string;
  pickupInstructions?: string;
  returnInstructions?: string;
  conditionAtPickup?: string;
  conditionAtReturn?: string;
  damageReported?: boolean;
  damageDescription?: string;
  damagePhotos?: string[];
  extensionRequested?: boolean;
  extensionApproved?: boolean;
  status: string;
  createdAt: Date;
  approvedAt?: Date;
  deniedAt?: Date;
  denialReason?: string;
  currentUserId: string;
  conversationId?: string | null;
  hasReview?: boolean;
  canLeaveReview?: boolean;
  review?: {
    id: string;
    rating: number;
    comment: string | null;
    title: string | null;
    accuracyRating: number | null;
    listingConditionRating: number | null;
    ownerCommunicationRating: number | null;
    createdAt: Date;
    reviewer: {
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string | null;
    } | null;
  } | null;
}

// Utility types for specific components
export type RentalStatusInfo = Pick<
  RentalDetails,
  | "status"
  | "totalAmount"
  | "createdAt"
  | "approvedAt"
  | "deniedAt"
  | "denialReason"
  | "actualStartDate"
  | "actualEndDate"
>;
export type RentalListingInfo = Pick<
  RentalDetails,
  | "listingId"
  | "listingName"
  | "listingImageUrl"
  | "listingBrand"
  | "listingModel"
  | "listingCondition"
  | "listingSpecifications"
>;
export type RentalDetailsInfo = Pick<
  RentalDetails,
  | "startDate"
  | "endDate"
  | "totalDays"
  | "dailyRate"
  | "totalAmount"
  | "securityDeposit"
  | "deliveryRequested"
  | "deliveryAddress"
  | "deliveryInstructions"
  | "deliveryFee"
  | "pickupAddress"
  | "setupRequested"
  | "setupFee"
  | "serviceFee"
  | "selectedWindow"
  | "pickupInstructions"
  | "returnInstructions"
  | "status"
>;
export type RentalUserInfo = Pick<
  RentalDetails,
  | "renterId"
  | "renterName"
  | "renterEmail"
  | "renterPhone"
  | "renterProfileImage"
  | "renterRating"
  | "renterReviewCount"
  | "renterVerified"
  | "renterMemberSince"
  | "renterCompletedRentals"
  | "renterResponseRate"
  | "ownerId"
  | "ownerName"
  | "ownerEmail"
  | "ownerPhone"
  | "ownerProfileImage"
  | "ownerRating"
  | "ownerReviewCount"
  | "ownerVerified"
  | "ownerMemberSince"
  | "ownerListingsListed"
  | "ownerResponseRate"
  | "listingId"
  | "listingName"
  | "conversationId"
>;
export type RentalActionsInfo = Pick<
  RentalDetails,
  | "id"
  | "listingId"
  | "listingName"
  | "renterName"
  | "status"
  | "startDate"
  | "endDate"
  | "pickupInstructions"
  | "returnInstructions"
  | "deliveryRequested"
  | "hasReview"
  | "canLeaveReview"
>;
export type RentalMessagesInfo = Pick<
  RentalDetails,
  "message" | "pickupInstructions" | "returnInstructions"
>;

export class RentalDAL extends BaseDAL {
  async countBorrowedListings(userId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(rentalRequests)
      .where(
        and(
          eq(rentalRequests.renterId, userId),
          inArray(rentalRequests.status, ["active"]),
        ),
      );

    return result.length;
  }

  async countSharedListings(userId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(rentalRequests)
      .where(
        and(
          eq(rentalRequests.ownerId, userId),
          inArray(rentalRequests.status, ["active"]),
        ),
      );

    return result.length;
  }

  async getBorrowedListings(userId: string): Promise<BorrowedListingsData> {
    try {
      const now = new Date();

      // Get all active and approved rentals for the user
      const allRentals = await this.db
        .select({
          id: rentalRequests.id,
          listingId: rentalRequests.listingId,
          listingName: listings.name,
          ownerId: rentalRequests.ownerId,
          ownerName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalAmount: rentalRequests.totalAmount,
          status: rentalRequests.status,
          dailyRate: rentalRequests.dailyRate,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .where(
          and(
            eq(rentalRequests.renterId, userId),
            inArray(rentalRequests.status, ["approved", "active"]),
          ),
        )
        .orderBy(rentalRequests.startDate);

      // Get images for all listings
      const listingIds = [
        ...new Set(allRentals.map((rental) => rental.listingId)),
      ];
      const listingImagesMap = new Map<string, string | null>();

      for (const listingId of listingIds) {
        const [firstImage] = await this.db
          .select({ imageUrl: listingImages.imageUrl })
          .from(listingImages)
          .where(eq(listingImages.listingId, listingId))
          .orderBy(listingImages.orderIndex)
          .limit(1);

        listingImagesMap.set(listingId, firstImage?.imageUrl || null);
      }

      // Separate current and upcoming rentals
      const currentRentals: BorrowedListing[] = [];
      const upcomingRentals: BorrowedListing[] = [];

      for (const rental of allRentals) {
        const listingWithImage: BorrowedListing = {
          ...rental,
          listingImageUrl: listingImagesMap.get(rental.listingId) || null,
        };

        // Current rentals: started and not yet ended
        if (rental.startDate <= now && rental.endDate >= now) {
          currentRentals.push(listingWithImage);
        }
        // Upcoming rentals: haven't started yet
        else if (rental.startDate > now) {
          upcomingRentals.push(listingWithImage);
        }
      }

      return {
        currentRentals,
        upcomingRentals,
      };
    } catch (error) {
      this.handleError(error, "getBorrowedListings");
    }
  }

  async insertRentalRequest(
    payload: InsertRentalRequestPayload,
  ): Promise<{ id: string }> {
    try {
      const [rentalRequest] = await this.db
        .insert(rentalRequests)
        .values({
          listingId: payload.listingId,
          renterId: payload.renterId,
          ownerId: payload.ownerId,
          startDate: payload.startDate,
          endDate: payload.endDate,
          totalDays: payload.totalDays,
          dailyRate: payload.dailyRate,
          totalAmount: payload.totalAmount,
          securityDeposit: payload.securityDeposit,
          deliveryRequested: payload.deliveryRequested,
          deliveryAddress: payload.deliveryAddress,
          deliveryInstructions: payload.deliveryInstructions,
          deliveryFee: payload.deliveryFee,
          setupRequested: payload.setupRequested,
          setupFee: payload.setupFee,
          serviceFee: payload.serviceFee,
          applicationFeeAmount: payload.applicationFeeAmount,
          ownerPayout: payload.ownerPayout,
          platformNetRevenue: payload.platformNetRevenue,
          message: payload.message,
          paymentIntentId: payload.paymentIntentId,
          paymentMethodId: payload.paymentMethodId,
          status: payload.status,
        })
        .returning();

      return { id: rentalRequest.id };
    } catch (error) {
      this.handleError(error, "insertRentalRequest");
    }
  }

  async getRentalRequestById(
    requestId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId?: string,
  ): Promise<{
    id: string;
    listingId: string;
    listingName: string;
    listingImageUrl: string | null;
    renterId: string;
    ownerId: string;
    ownerName: string;
    startDate: Date;
    endDate: Date;
    totalDays: number;
    dailyRate: string;
    totalAmount: string;
    securityDeposit: string;
    deliveryRequested: boolean;
    deliveryAddress: string | null;
    deliveryFee: string;
    setupRequested: boolean;
    setupFee: string;
    serviceFee: string;
    applicationFeeAmount: string;
    ownerPayout: string;
    platformNetRevenue: string;
    message: string | null;
    paymentIntentId: string | null;
    paymentMethodId: string | null;
    status: string;
    createdAt: Date;
  }> {
    try {
      // Get rental request with related data
      const rentalRequest = await this.db
        .select({
          id: rentalRequests.id,
          listingId: rentalRequests.listingId,
          listingName: listings.name,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          ownerName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          totalAmount: rentalRequests.totalAmount,
          securityDeposit: rentalRequests.securityDeposit,
          deliveryRequested: rentalRequests.deliveryRequested,
          deliveryAddress: rentalRequests.deliveryAddress,
          deliveryFee: rentalRequests.deliveryFee,
          setupRequested: rentalRequests.setupRequested,
          setupFee: rentalRequests.setupFee,
          serviceFee: rentalRequests.serviceFee,
          applicationFeeAmount: rentalRequests.applicationFeeAmount,
          ownerPayout: rentalRequests.ownerPayout,
          platformNetRevenue: rentalRequests.platformNetRevenue,
          message: rentalRequests.message,
          paymentIntentId: rentalRequests.paymentIntentId,
          paymentMethodId: rentalRequests.paymentMethodId,
          status: rentalRequests.status,
          createdAt: rentalRequests.createdAt,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .where(eq(rentalRequests.id, requestId))
        .limit(1);

      if (rentalRequest.length === 0) {
        throw new NotFoundError("Rental request", requestId);
      }

      const request = rentalRequest[0];

      // Get listing image
      const [firstImage] = await this.db
        .select({ imageUrl: listingImages.imageUrl })
        .from(listingImages)
        .where(eq(listingImages.listingId, request.listingId))
        .orderBy(listingImages.orderIndex)
        .limit(1);

      return {
        ...request,
        listingImageUrl: firstImage?.imageUrl || null,
      };
    } catch (error) {
      this.handleError(error, "getRentalRequestById");
    }
  }

  /**
   * Returns the number of approved/active/completed rental requests for a renter.
   * Used to detect "first approval" for push permission prompt.
   */
  async getApprovedRentalCountForRenter(renterId: string): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(rentalRequests)
        .where(
          and(
            eq(rentalRequests.renterId, renterId),
            inArray(rentalRequests.status, ["approved", "active", "completed"]),
          ),
        );
      return result[0]?.count ?? 0;
    } catch (error) {
      this.handleError(error, "getApprovedRentalCountForRenter");
    }
  }

  async getRentalRequestsByStatus(
    status:
      | "pending"
      | "approved"
      | "active"
      | "completed"
      | "cancelled"
      | "overdue"
      | "denied",
    renterId: string,
  ): Promise<RentalRequestItem[]> {
    try {
      // Get rental requests with related data
      const requests = await this.db
        .select({
          id: rentalRequests.id,
          listingId: rentalRequests.listingId,
          listingName: listings.name,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          ownerName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          totalAmount: rentalRequests.totalAmount,
          status: rentalRequests.status,
          createdAt: rentalRequests.createdAt,
          deliveryRequested: rentalRequests.deliveryRequested,
          setupRequested: rentalRequests.setupRequested,
          setupFee: rentalRequests.setupFee,
          message: rentalRequests.message,
          deniedAt: rentalRequests.deniedAt,
          denialReason: rentalRequests.denialReason,
          approvedAt: rentalRequests.approvedAt,
          conversationId: conversations.id,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .leftJoin(
          conversations,
          and(
            eq(
              conversations.user1Id,
              sql`LEAST(${renterId}, ${rentalRequests.ownerId})`,
            ),
            eq(
              conversations.user2Id,
              sql`GREATEST(${renterId}, ${rentalRequests.ownerId})`,
            ),
          ),
        )
        .where(
          and(
            eq(rentalRequests.renterId, renterId),
            eq(rentalRequests.status, status),
          ),
        )
        .orderBy(rentalRequests.createdAt);

      // Get images for all listings
      const listingIds = [
        ...new Set(requests.map((request) => request.listingId)),
      ];
      const listingImagesMap = new Map<string, string | null>();

      for (const listingId of listingIds) {
        const [firstImage] = await this.db
          .select({ imageUrl: listingImages.imageUrl })
          .from(listingImages)
          .where(eq(listingImages.listingId, listingId))
          .orderBy(listingImages.orderIndex)
          .limit(1);

        listingImagesMap.set(listingId, firstImage?.imageUrl || null);
      }

      // Add listing images to requests
      return requests.map((request) => ({
        ...request,
        listingImageUrl: listingImagesMap.get(request.listingId) || null,
      }));
    } catch (error) {
      this.handleError(error, "getRentalRequestsByStatus");
    }
  }

  async getLendingRequestsByStatus(
    status:
      | "pending"
      | "approved"
      | "active"
      | "completed"
      | "cancelled"
      | "overdue"
      | "denied",
    ownerId: string,
  ): Promise<LendingRequestItem[]> {
    try {
      // Get rental requests where current user is the owner
      const requests = await this.db
        .select({
          id: rentalRequests.id,
          listingId: rentalRequests.listingId,
          listingName: listings.name,
          renterId: rentalRequests.renterId,
          renterName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          renterProfileImage: user.profileImageUrl,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          totalAmount: rentalRequests.totalAmount,
          securityDeposit: rentalRequests.securityDeposit,
          status: rentalRequests.status,
          createdAt: rentalRequests.createdAt,
          deliveryRequested: rentalRequests.deliveryRequested,
          deliveryAddress: rentalRequests.deliveryAddress,
          deliveryFee: rentalRequests.deliveryFee,
          setupRequested: rentalRequests.setupRequested,
          setupFee: rentalRequests.setupFee,
          message: rentalRequests.message,
          deniedAt: rentalRequests.deniedAt,
          denialReason: rentalRequests.denialReason,
          approvedAt: rentalRequests.approvedAt,
          conversationId: conversations.id,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.renterId, user.id))
        .leftJoin(
          conversations,
          and(
            eq(
              conversations.user1Id,
              sql`LEAST(${ownerId}, ${rentalRequests.renterId})`,
            ),
            eq(
              conversations.user2Id,
              sql`GREATEST(${ownerId}, ${rentalRequests.renterId})`,
            ),
          ),
        )
        .where(
          and(
            eq(rentalRequests.ownerId, ownerId),
            eq(rentalRequests.status, status),
          ),
        )
        .orderBy(rentalRequests.createdAt);

      // Get images for all listings
      const listingIds = [
        ...new Set(requests.map((request) => request.listingId)),
      ];
      const listingImagesMap = new Map<string, string | null>();

      for (const listingId of listingIds) {
        const [firstImage] = await this.db
          .select({ imageUrl: listingImages.imageUrl })
          .from(listingImages)
          .where(eq(listingImages.listingId, listingId))
          .orderBy(listingImages.orderIndex)
          .limit(1);

        listingImagesMap.set(listingId, firstImage?.imageUrl || null);
      }

      // Add listing images to requests
      return requests.map((request) => ({
        ...request,
        listingImageUrl: listingImagesMap.get(request.listingId) || null,
        renterRating: undefined, // TODO: Calculate from reviews
        renterReviewCount: undefined, // TODO: Calculate from reviews
        renterVerified: undefined, // TODO: Get from user verification status
        selectedWindow: undefined, // TODO: Add to schema if needed
      }));
    } catch (error) {
      this.handleError(error, "getLendingRequestsByStatus");
    }
  }

  /**
   * Get overdue items for dashboard: as borrower (endDate passed, not returned) or
   * as owner (lent out, return overdue). Each item includes id, listingName,
   * statusText (e.g. "3 days late"), otherPartyName, and linkTo for rental/request detail.
   *
   * @param userId - Current user id (renter or owner)
   * @returns Array of overdue items for OverdueAlertsWidget
   */
  async getOverdueItemsForUser(userId: string): Promise<
    Array<{
      id: string;
      listingName: string;
      statusText: string;
      otherPartyName: string;
      linkTo: string;
    }>
  > {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rows = await this.db
        .select({
          id: rentalRequests.id,
          listingName: listings.name,
          renterId: rentalRequests.renterId,
          ownerName:
            sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`.as(
              "owner_name",
            ),
          endDate: rentalRequests.endDate,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .where(
          and(
            or(
              eq(rentalRequests.renterId, userId),
              eq(rentalRequests.ownerId, userId),
            ),
            lt(rentalRequests.endDate, today),
            inArray(rentalRequests.status, ["approved", "active"]),
          ),
        )
        .orderBy(rentalRequests.endDate);

      if (rows.length === 0) return [];

      const renterIds = [...new Set(rows.map((r) => r.renterId))];
      const renterNames = new Map<string, string>();
      if (renterIds.length > 0) {
        const renterRows = await this.db
          .select({
            id: user.id,
            name: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          })
          .from(user)
          .where(inArray(user.id, renterIds));
        renterRows.forEach((r) => renterNames.set(r.id, r.name));
      }

      return rows.map((row) => {
        const daysLate = differenceInDays(today, row.endDate);
        const statusText =
          daysLate === 1 ? "1 day late" : `${daysLate} days late`;
        const isBorrower = row.renterId === userId;
        const otherPartyName = isBorrower
          ? row.ownerName
          : (renterNames.get(row.renterId) ?? "Unknown");
        const linkTo = isBorrower
          ? `/dashboard/rental/${row.id}?view=renting`
          : `/dashboard/rental/${row.id}?view=lending`;
        return {
          id: row.id,
          listingName: row.listingName,
          statusText,
          otherPartyName,
          linkTo,
        };
      });
    } catch (error) {
      this.handleError(error, "getOverdueItemsForUser");
    }
  }

  /**
   * Get rentals per month for dashboard Mini-Analytics (rentals per period).
   * Counts rental_requests with status approved/active/completed where startDate
   * falls in each month. Returns last N months (missing months as zeros).
   *
   * @param userId - Current user id (as renter or owner)
   * @param numberOfMonths - Last N months (e.g. 6)
   * @returns Array of { year, month, monthLabel, renterCount, ownerCount }
   */
  async getRentalsPerMonth(
    userId: string,
    numberOfMonths: number,
  ): Promise<
    Array<{
      year: number;
      month: number;
      monthLabel: string;
      renterCount: number;
      ownerCount: number;
    }>
  > {
    try {
      const now = new Date();
      const startBound = new Date(
        now.getFullYear(),
        now.getMonth() - numberOfMonths,
        1,
      );

      const rows = await this.db
        .select({
          startDate: rentalRequests.startDate,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
        })
        .from(rentalRequests)
        .where(
          and(
            inArray(rentalRequests.status, ["approved", "active", "completed"]),
            or(
              eq(rentalRequests.renterId, userId),
              eq(rentalRequests.ownerId, userId),
            ),
            gte(rentalRequests.startDate, startBound),
          ),
        );

      const monthKeys = new Map<
        string,
        { renterCount: number; ownerCount: number }
      >();
      for (let i = 0; i < numberOfMonths; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthKeys.set(key, { renterCount: 0, ownerCount: 0 });
      }
      for (const row of rows) {
        const d = new Date(row.startDate);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const cur = monthKeys.get(key);
        if (cur) {
          if (row.renterId === userId) cur.renterCount += 1;
          if (row.ownerId === userId) cur.ownerCount += 1;
        }
      }

      const result: Array<{
        year: number;
        month: number;
        monthLabel: string;
        renterCount: number;
        ownerCount: number;
      }> = [];
      for (let i = numberOfMonths - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const cur = monthKeys.get(key) ?? {
          renterCount: 0,
          ownerCount: 0,
        };
        result.push({
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          monthLabel: d.toLocaleString("default", {
            month: "short",
            year: "2-digit",
          }),
          renterCount: cur.renterCount,
          ownerCount: cur.ownerCount,
        });
      }
      return result;
    } catch (error) {
      this.handleError(error, "getRentalsPerMonth");
    }
  }

  /**
   * Get recent rental activity for dashboard activity feed.
   * Returns rental requests (as renter or owner) ordered by updatedAt desc.
   *
   * @param userId - Current user id
   * @param limit - Max items to return
   * @returns Array with id, listingName, role, status, updatedAt, linkTo
   */
  async getRecentRentalActivity(
    userId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      listingName: string;
      role: "renter" | "owner";
      status: string;
      updatedAt: Date;
      linkTo: string;
    }>
  > {
    try {
      const rows = await this.db
        .select({
          id: rentalRequests.id,
          listingName: listings.name,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          status: rentalRequests.status,
          updatedAt: rentalRequests.updatedAt,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .where(
          or(
            eq(rentalRequests.renterId, userId),
            eq(rentalRequests.ownerId, userId),
          ),
        )
        .orderBy(desc(rentalRequests.updatedAt))
        .limit(limit);

      return rows.map((row) => ({
        id: row.id,
        listingName: row.listingName,
        role: row.renterId === userId ? "renter" : "owner",
        status: row.status,
        updatedAt: row.updatedAt,
        linkTo:
          row.renterId === userId
            ? `/dashboard/rental/${row.id}?view=renting`
            : `/dashboard/rental/${row.id}?view=lending`,
      }));
    } catch (error) {
      this.handleError(error, "getRecentRentalActivity");
    }
  }

  async getRentalsByStatus(
    status:
      | "pending"
      | "approved"
      | "active"
      | "completed"
      | "cancelled"
      | "overdue"
      | "denied",
    renterId: string,
  ): Promise<BorrowedListing[]> {
    try {
      // Get rentals with related data
      const rentalsList = await this.db
        .select({
          id: rentalRequests.id,
          listingId: rentalRequests.listingId,
          listingName: listings.name,
          ownerId: rentalRequests.ownerId,
          ownerName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalAmount: rentalRequests.totalAmount,
          status: rentalRequests.status,
          dailyRate: rentalRequests.dailyRate,
          deliveryRequested: rentalRequests.deliveryRequested,
          setupRequested: rentalRequests.setupRequested,
          setupFee: rentalRequests.setupFee,
          conversationId: conversations.id,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .leftJoin(
          conversations,
          and(
            eq(
              conversations.user1Id,
              sql`LEAST(${renterId}, ${rentalRequests.ownerId})`,
            ),
            eq(
              conversations.user2Id,
              sql`GREATEST(${renterId}, ${rentalRequests.ownerId})`,
            ),
          ),
        )
        .where(
          and(
            eq(rentalRequests.renterId, renterId),
            eq(rentalRequests.status, status),
          ),
        )
        .orderBy(rentalRequests.startDate);

      // Get images for all listings
      const listingIds = [
        ...new Set(rentalsList.map((rental) => rental.listingId)),
      ];
      const listingImagesMap = new Map<string, string | null>();

      for (const listingId of listingIds) {
        const [firstImage] = await this.db
          .select({ imageUrl: listingImages.imageUrl })
          .from(listingImages)
          .where(eq(listingImages.listingId, listingId))
          .orderBy(listingImages.orderIndex)
          .limit(1);

        listingImagesMap.set(listingId, firstImage?.imageUrl || null);
      }

      // For completed rentals, check review eligibility
      const canLeaveReviewMap = new Map<string, boolean>();
      if (status === "completed") {
        const rentalRequestIds = rentalsList.map((r) => r.id);

        // Get actual rental records for these requests
        const actualRentals = await this.db
          .select({
            requestId: rentals.requestId,
            id: rentals.id,
            damageReported: rentals.damageReported,
          })
          .from(rentals)
          .where(inArray(rentals.requestId, rentalRequestIds));

        // Get existing reviews for these rentals
        const rentalIds = actualRentals.map((r) => r.id);
        const existingReviews =
          rentalIds.length > 0
            ? await this.db
                .select({ rentalId: reviews.rentalId })
                .from(reviews)
                .where(inArray(reviews.rentalId, rentalIds))
            : [];

        const reviewedRentalIds = new Set(
          existingReviews.map((r) => r.rentalId),
        );

        // Build map of requestId -> canLeaveReview
        for (const rental of actualRentals) {
          const canLeave =
            !rental.damageReported &&
            !reviewedRentalIds.has(rental.id) &&
            rental.requestId !== null;
          canLeaveReviewMap.set(rental.requestId, canLeave);
        }
      }

      // Add listing images and canLeaveReview to rentals
      return rentalsList.map((rental) => ({
        ...rental,
        listingImageUrl: listingImagesMap.get(rental.listingId) || null,
        canLeaveReview:
          status === "completed"
            ? canLeaveReviewMap.get(rental.id) || false
            : undefined,
      }));
    } catch (error) {
      this.handleError(error, "getRentalsByStatus");
    }
  }

  async getLendingRentalsByStatus(
    status:
      | "pending"
      | "approved"
      | "active"
      | "completed"
      | "cancelled"
      | "overdue"
      | "denied",
    ownerId: string,
  ): Promise<LendingRequestItem[]> {
    try {
      // Get rentals where current user is the owner
      const rentalsList = await this.db
        .select({
          id: rentalRequests.id,
          listingId: rentalRequests.listingId,
          listingName: listings.name,
          renterId: rentalRequests.renterId,
          renterName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          renterProfileImage: user.profileImageUrl,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          totalAmount: rentalRequests.totalAmount,
          securityDeposit: rentalRequests.securityDeposit,
          status: rentalRequests.status,
          createdAt: rentalRequests.createdAt,
          deliveryRequested: rentalRequests.deliveryRequested,
          deliveryAddress: rentalRequests.deliveryAddress,
          deliveryFee: rentalRequests.deliveryFee,
          setupRequested: rentalRequests.setupRequested,
          setupFee: rentalRequests.setupFee,
          message: rentalRequests.message,
          deniedAt: rentalRequests.deniedAt,
          denialReason: rentalRequests.denialReason,
          approvedAt: rentalRequests.approvedAt,
          conversationId: conversations.id,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.renterId, user.id))
        .leftJoin(
          conversations,
          and(
            eq(
              conversations.user1Id,
              sql`LEAST(${ownerId}, ${rentalRequests.renterId})`,
            ),
            eq(
              conversations.user2Id,
              sql`GREATEST(${ownerId}, ${rentalRequests.renterId})`,
            ),
          ),
        )
        .where(
          and(
            eq(rentalRequests.ownerId, ownerId),
            eq(rentalRequests.status, status),
          ),
        )
        .orderBy(rentalRequests.createdAt);

      // Get images for all listings
      const listingIds = [
        ...new Set(rentalsList.map((rental) => rental.listingId)),
      ];
      const listingImagesMap = new Map<string, string | null>();

      for (const listingId of listingIds) {
        const [firstImage] = await this.db
          .select({ imageUrl: listingImages.imageUrl })
          .from(listingImages)
          .where(eq(listingImages.listingId, listingId))
          .orderBy(listingImages.orderIndex)
          .limit(1);

        listingImagesMap.set(listingId, firstImage?.imageUrl || null);
      }

      // Add listing images to rentals
      return rentalsList.map((rental) => ({
        ...rental,
        listingImageUrl: listingImagesMap.get(rental.listingId) || null,
        renterRating: undefined, // TODO: Calculate from reviews
        renterReviewCount: undefined, // TODO: Calculate from reviews
        renterVerified: undefined, // TODO: Get from user verification status
        selectedWindow: undefined, // TODO: Add to schema if needed
      }));
    } catch (error) {
      this.handleError(error, "getLendingRentalsByStatus");
    }
  }

  /**
   * Cancel a rental request
   * Only the renter can cancel their own pending requests
   */
  async cancelRentalRequest(
    requestId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
  ): Promise<void> {
    try {
      // First, verify the request exists
      const request = await this.db
        .select({
          id: rentalRequests.id,
          status: rentalRequests.status,
          renterId: rentalRequests.renterId,
        })
        .from(rentalRequests)
        .where(eq(rentalRequests.id, requestId))
        .limit(1);

      if (!request.length) {
        throw new NotFoundError("Rental request not found");
      }

      if (request[0].status !== "pending") {
        throw new Error("Only pending requests can be cancelled");
      }

      // Update the request status to cancelled
      await this.db
        .update(rentalRequests)
        .set({
          status: "cancelled",
          deniedAt: new Date(),
          denialReason: "Cancelled by renter",
        })
        .where(eq(rentalRequests.id, requestId));
    } catch (error) {
      this.handleError(error, "cancelRentalRequest");
    }
  }

  /**
   * Update rental request payment status
   */
  async updateRentalRequestPaymentStatus(
    requestId: string,
    paymentData: {
      paymentStatus:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded";
      paymentIntentId?: string;
      securityDepositAuthId?: string;
      paymentFailureReason?: string;
    },
  ): Promise<void> {
    try {
      await this.db
        .update(rentalRequests)
        .set({
          ...paymentData,
          updatedAt: new Date(),
        })
        .where(eq(rentalRequests.id, requestId));
    } catch (error) {
      this.handleError(error, "updateRentalRequestPaymentStatus");
    }
  }

  /**
   * Update payment method ID on a rental request (e.g. when resolved from Stripe fallback).
   */
  async updateRentalRequestPaymentMethod(
    requestId: string,
    paymentMethodId: string,
  ): Promise<void> {
    try {
      await this.db
        .update(rentalRequests)
        .set({
          paymentMethodId,
          updatedAt: new Date(),
        })
        .where(eq(rentalRequests.id, requestId));
    } catch (error) {
      this.handleError(error, "updateRentalRequestPaymentMethod");
    }
  }

  /**
   * Approve a rental request
   * Only the owner can approve their own pending requests
   */
  async approveRentalRequest(
    requestId: string,
    _ownerId: string,
    options?: {
      pickupInstructions?: string;
      returnInstructions?: string;
      rentalPaymentIntentId?: string;
      securityDepositAuthId?: string;
      applicationFeeAmount?: string;
    },
  ): Promise<void> {
    try {
      // Get the rental request
      const [request] = await this.db
        .select()
        .from(rentalRequests)
        .where(eq(rentalRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new NotFoundError("Rental request not found");
      }

      if (request.status !== "pending") {
        throw new Error("Only pending requests can be approved");
      }

      // Update the rental request status and payment info
      await this.db
        .update(rentalRequests)
        .set({
          status: "approved",
          approvedAt: new Date(),
          paymentStatus: "succeeded",
          ...(options?.rentalPaymentIntentId && {
            paymentIntentId: options.rentalPaymentIntentId,
          }),
          ...(options?.securityDepositAuthId && {
            securityDepositAuthId: options.securityDepositAuthId,
          }),
        })
        .where(eq(rentalRequests.id, requestId));

      // Create a rental entry
      await this.db.insert(rentals).values({
        requestId: requestId,
        listingId: request.listingId,
        renterId: request.renterId,
        ownerId: request.ownerId,
        startDate: request.startDate,
        endDate: request.endDate,
        totalAmount: request.totalAmount,
        securityDeposit: request.securityDeposit,
        setupRequested: request.setupRequested,
        setupFee: request.setupFee,
        rentalPaymentIntentId: options?.rentalPaymentIntentId || null,
        securityDepositAuthId: options?.securityDepositAuthId || null,
        applicationFeeAmount: options?.applicationFeeAmount || null,
        pickupInstructions: options?.pickupInstructions || null,
        returnInstructions: options?.returnInstructions || null,
      });
    } catch (error) {
      this.handleError(error, "approveRentalRequest");
    }
  }

  /**
   * Get rental by its rental request ID (used after approving a request to get the new rental id).
   */
  async getRentalByRequestId(
    requestId: string,
  ): Promise<{ id: string } | null> {
    try {
      const [row] = await this.db
        .select({ id: rentals.id })
        .from(rentals)
        .where(eq(rentals.requestId, requestId))
        .limit(1);
      return row ?? null;
    } catch (error) {
      this.handleError(error, "getRentalByRequestId");
    }
  }

  /**
   * Decline a rental request
   * Only the owner can decline their own pending requests
   */
  async declineRentalRequest(
    requestId: string,
    denialReason: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ownerId: string,
  ): Promise<void> {
    try {
      // Get the rental request
      const [request] = await this.db
        .select()
        .from(rentalRequests)
        .where(eq(rentalRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new NotFoundError("Rental request not found");
      }

      if (request.status !== "pending") {
        throw new Error("Only pending requests can be declined");
      }

      // Update the rental request status
      await this.db
        .update(rentalRequests)
        .set({
          status: "denied",
          deniedAt: new Date(),
          denialReason: denialReason,
        })
        .where(eq(rentalRequests.id, requestId));
    } catch (error) {
      this.handleError(error, "declineRentalRequest");
    }
  }

  /**
   * Update rental instructions (pickup and return)
   * Only the owner can update instructions for approved or active rentals
   * @param rentalRequestId - The rental request ID (can be from either rental_requests or rentals table)
   */
  async updateRentalInstructions(
    rentalRequestId: string,
    ownerId: string,
    pickupInstructions?: string,
    returnInstructions?: string,
  ): Promise<{
    rental: {
      id: string;
      ownerId: string;
      renterId: string;
      listingId: string;
      status: string;
    };
    renterEmail: string;
    renterName: string;
    ownerName: string;
    listingName: string;
  }> {
    try {
      // Get the rental request to verify status
      const [rentalRequest] = await this.db
        .select({
          id: rentalRequests.id,
          ownerId: rentalRequests.ownerId,
          renterId: rentalRequests.renterId,
          listingId: rentalRequests.listingId,
          status: rentalRequests.status,
        })
        .from(rentalRequests)
        .where(eq(rentalRequests.id, rentalRequestId))
        .limit(1);

      if (!rentalRequest) {
        throw new NotFoundError("Rental not found");
      }

      // Verify status from rental_requests
      if (
        rentalRequest.status !== "approved" &&
        rentalRequest.status !== "active"
      ) {
        throw new Error(
          "Instructions can only be updated for approved or active rentals",
        );
      }

      // Sanitize instruction fields
      const sanitizedPickupInstructions = pickupInstructions
        ? sanitizeTextWithMaxLength(pickupInstructions, 2000)
        : null;
      const sanitizedReturnInstructions = returnInstructions
        ? sanitizeTextWithMaxLength(returnInstructions, 2000)
        : null;

      // Update the rental instructions in the rentals table
      await this.db
        .update(rentals)
        .set({
          pickupInstructions: sanitizedPickupInstructions,
          returnInstructions: sanitizedReturnInstructions,
          updatedAt: new Date(),
        })
        .where(eq(rentals.requestId, rentalRequestId));

      // Get renter and owner details for email notification
      const [renterUser] = await this.db
        .select({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(user)
        .where(eq(user.id, rentalRequest.renterId))
        .limit(1);

      const [ownerUser] = await this.db
        .select({
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(user)
        .where(eq(user.id, rentalRequest.ownerId))
        .limit(1);

      const [listing] = await this.db
        .select({
          name: listings.name,
        })
        .from(listings)
        .where(eq(listings.id, rentalRequest.listingId))
        .limit(1);

      if (!renterUser || !ownerUser || !listing) {
        throw new Error("Failed to fetch user or listing details");
      }

      return {
        rental: {
          id: rentalRequest.id,
          ownerId: rentalRequest.ownerId,
          renterId: rentalRequest.renterId,
          listingId: rentalRequest.listingId,
          status: rentalRequest.status,
        },
        renterEmail: renterUser.email,
        renterName: `${renterUser.firstName} ${renterUser.lastName}`,
        ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
        listingName: listing.name,
      };
    } catch (error) {
      this.handleError(error, "updateRentalInstructions");
    }
  }

  /**
   * Get rental details by ID
   * This method handles both rental requests and actual rentals
   */
  async getRentalDetailsById(
    rentalId: string,
    userId?: string,
  ): Promise<RentalDetails> {
    try {
      // First try to find as a rental request
      const rentalRequest = await this.db
        .select({
          id: rentalRequests.id,
          listingId: rentalRequests.listingId,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          totalAmount: rentalRequests.totalAmount,
          securityDeposit: rentalRequests.securityDeposit,
          deliveryRequested: rentalRequests.deliveryRequested,
          deliveryAddress: rentalRequests.deliveryAddress,
          deliveryInstructions: rentalRequests.deliveryInstructions,
          deliveryFee: rentalRequests.deliveryFee,
          setupRequested: rentalRequests.setupRequested,
          setupFee: rentalRequests.setupFee,
          serviceFee: rentalRequests.serviceFee,
          message: rentalRequests.message,
          status: rentalRequests.status,
          createdAt: rentalRequests.createdAt,
          approvedAt: rentalRequests.approvedAt,
          deniedAt: rentalRequests.deniedAt,
          denialReason: rentalRequests.denialReason,
          // Join with rentals table to get pickup/return instructions and actual dates if approved
          pickupInstructions: rentals.pickupInstructions,
          returnInstructions: rentals.returnInstructions,
          actualStartDate: rentals.actualStartDate,
          actualEndDate: rentals.actualEndDate,
          conversationId: conversations.id,
        })
        .from(rentalRequests)
        .leftJoin(rentals, eq(rentals.requestId, rentalRequests.id))
        .leftJoin(
          conversations,
          and(
            eq(
              conversations.user1Id,
              sql`LEAST(${rentalRequests.renterId}, ${rentalRequests.ownerId})`,
            ),
            eq(
              conversations.user2Id,
              sql`GREATEST(${rentalRequests.renterId}, ${rentalRequests.ownerId})`,
            ),
          ),
        )
        .where(eq(rentalRequests.id, rentalId))
        .limit(1);

      if (rentalRequest.length > 0) {
        const request = rentalRequest[0];

        // Get listing details
        const listing = await this.db.query.listings.findFirst({
          where: eq(listings.id, request.listingId),
        });

        // Get listing image
        const [firstImage] = await this.db
          .select({ imageUrl: listingImages.imageUrl })
          .from(listingImages)
          .where(eq(listingImages.listingId, request.listingId))
          .orderBy(listingImages.orderIndex)
          .limit(1);

        // Get renter details
        const renter = await this.db.query.user.findFirst({
          where: eq(user.id, request.renterId),
        });

        // Get renter reviews and stats
        const renterReviews = await this.db.query.reviews.findMany({
          where: eq(reviews.revieweeId, request.renterId),
          columns: { rating: true },
        });
        const renterRatings = renterReviews.map((r) => r.rating);
        const renterAverageRating =
          renterRatings.length > 0
            ? renterRatings.reduce((a, b) => a + b, 0) / renterRatings.length
            : 0;

        // Get renter completed rentals count
        const renterCompletedRentals = await this.db
          .select()
          .from(rentalRequests)
          .where(
            and(
              eq(rentalRequests.renterId, request.renterId),
              eq(rentalRequests.status, "completed"),
            ),
          );

        // Get owner details
        const owner = await this.db.query.user.findFirst({
          where: eq(user.id, request.ownerId),
        });

        // Get owner reviews
        const ownerReviews = await this.db.query.reviews.findMany({
          where: eq(reviews.revieweeId, request.ownerId),
          columns: { rating: true },
        });
        const ownerRatings = ownerReviews.map((r) => r.rating);
        const ownerAverageRating =
          ownerRatings.length > 0
            ? ownerRatings.reduce((a, b) => a + b, 0) / ownerRatings.length
            : 0;

        // Get owner's primary address for pickup
        const ownerAddress = await this.db.query.userAddresses.findFirst({
          where: and(
            eq(userAddresses.userId, request.ownerId),
            eq(userAddresses.isPrimary, true),
          ),
        });

        // Format pickup address
        const pickupAddress = ownerAddress
          ? `${ownerAddress.street}, ${ownerAddress.city}, ${ownerAddress.state} ${ownerAddress.zipCode}`
          : undefined;

        // Check if rental exists and get review status
        const rentalRecord = await this.db
          .select({ id: rentals.id, damageReported: rentals.damageReported })
          .from(rentals)
          .where(eq(rentals.requestId, request.id))
          .limit(1);

        let hasReview = false;
        let canLeaveReview = false;
        let reviewData = null;

        if (rentalRecord[0]) {
          // Get full review if it exists
          const { data: reviewResult } = await tryCatch(
            reviewDALInstance.getReviewByRentalId(rentalRecord[0].id),
          );

          hasReview = !!reviewResult;

          if (reviewResult) {
            reviewData = {
              id: reviewResult.id,
              rating: reviewResult.rating,
              comment: reviewResult.comment,
              title: reviewResult.title,
              accuracyRating: reviewResult.accuracyRating,
              listingConditionRating: reviewResult.listingConditionRating,
              ownerCommunicationRating: reviewResult.ownerCommunicationRating,
              createdAt: reviewResult.createdAt,
              reviewer: reviewResult.reviewer
                ? {
                    id: reviewResult.reviewer.id,
                    firstName: reviewResult.reviewer.firstName || "",
                    lastName: reviewResult.reviewer.lastName || "",
                    profileImageUrl: reviewResult.reviewer.profileImageUrl,
                  }
                : null,
            };
          }

          // Can leave review if:
          // - Status is completed
          // - No damage reported
          // - No existing review
          // - User is renter
          canLeaveReview =
            userId !== undefined &&
            request.status === "completed" &&
            !rentalRecord[0].damageReported &&
            !hasReview &&
            request.renterId === userId;
        }

        return {
          id: request.id,
          type: "request",
          listingId: request.listingId,
          listingName: listing?.name || "Unknown listing",
          listingImageUrl: firstImage?.imageUrl || null,
          listingBrand: listing?.brand || undefined,
          listingModel: listing?.model || undefined,
          listingCondition: listing?.condition || undefined,
          listingDescription: listing?.description || undefined,
          renterId: request.renterId,
          renterName: renter
            ? `${renter.firstName} ${renter.lastName}`
            : "Unknown User",
          renterEmail: renter?.email || "",
          renterPhone: renter?.phone || undefined,
          renterProfileImage: renter?.profileImageUrl || undefined,
          renterRating:
            renterRatings.length > 0
              ? Math.round(renterAverageRating * 10) / 10
              : undefined,
          renterReviewCount: renterRatings.length || undefined,
          renterVerified: renter?.emailVerified || false,
          renterMemberSince: renter?.createdAt?.toISOString() || undefined,
          renterCompletedRentals: renterCompletedRentals.length || undefined,
          ownerId: request.ownerId,
          ownerName: owner
            ? `${owner.firstName} ${owner.lastName}`
            : "Unknown User",
          ownerEmail: owner?.email || "",
          ownerPhone: owner?.phone || undefined,
          ownerProfileImage: owner?.profileImageUrl || undefined,
          ownerRating:
            ownerRatings.length > 0
              ? Math.round(ownerAverageRating * 10) / 10
              : undefined,
          ownerReviewCount: ownerRatings.length || undefined,
          ownerVerified: owner?.emailVerified || false,
          ownerMemberSince: owner?.createdAt?.toISOString() || undefined,
          startDate: request.startDate,
          endDate: request.endDate,
          totalDays: request.totalDays,
          dailyRate: request.dailyRate,
          totalAmount: request.totalAmount,
          securityDeposit: request.securityDeposit,
          deliveryRequested: request.deliveryRequested,
          deliveryAddress: request.deliveryAddress || undefined,
          deliveryInstructions: request.deliveryInstructions || undefined,
          deliveryFee: request.deliveryFee,
          pickupAddress,
          setupRequested: request.setupRequested,
          setupFee: request.setupFee,
          serviceFee: request.serviceFee,
          message: request.message || undefined,
          pickupInstructions: request.pickupInstructions || undefined,
          returnInstructions: request.returnInstructions || undefined,
          status: request.status,
          createdAt: request.createdAt,
          approvedAt: request.approvedAt || undefined,
          deniedAt: request.deniedAt || undefined,
          denialReason: request.denialReason || undefined,
          actualStartDate: request.actualStartDate || undefined,
          actualEndDate: request.actualEndDate || undefined,
          currentUserId: userId || "",
          conversationId: request.conversationId || null,
          hasReview,
          canLeaveReview,
          review: reviewData,
        };
      }

      // If not found as request, try as rental (this shouldn't happen as we use request IDs)
      const rental = await this.db
        .select({
          id: rentals.id,
          requestId: rentals.requestId,
          listingId: rentals.listingId,
          renterId: rentals.renterId,
          ownerId: rentals.ownerId,
          startDate: rentals.startDate,
          endDate: rentals.endDate,
          actualStartDate: rentals.actualStartDate,
          actualEndDate: rentals.actualEndDate,
          totalAmount: rentals.totalAmount,
          securityDeposit: rentals.securityDeposit,
          pickupInstructions: rentals.pickupInstructions,
          returnInstructions: rentals.returnInstructions,
          conditionAtPickup: rentals.conditionAtPickup,
          conditionAtReturn: rentals.conditionAtReturn,
          damageReported: rentals.damageReported,
          damageDescription: rentals.damageDescription,
          damagePhotos: rentals.damagePhotos,
          extensionRequested: rentals.extensionRequested,
          extensionApproved: rentals.extensionApproved,
          createdAt: rentals.createdAt,
          conversationId: conversations.id,
        })
        .from(rentals)
        .leftJoin(
          conversations,
          and(
            eq(
              conversations.user1Id,
              sql`LEAST(${rentals.renterId}, ${rentals.ownerId})`,
            ),
            eq(
              conversations.user2Id,
              sql`GREATEST(${rentals.renterId}, ${rentals.ownerId})`,
            ),
          ),
        )
        .where(eq(rentals.id, rentalId))
        .limit(1);

      if (rental.length === 0) {
        throw new NotFoundError("Rental", rentalId);
      }

      const rentalData = rental[0];

      // Get the associated request for additional details
      const request = await this.db
        .select({
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          deliveryRequested: rentalRequests.deliveryRequested,
          deliveryAddress: rentalRequests.deliveryAddress,
          deliveryFee: rentalRequests.deliveryFee,
          setupRequested: rentalRequests.setupRequested,
          setupFee: rentalRequests.setupFee,
          serviceFee: rentalRequests.serviceFee,
          message: rentalRequests.message,
          status: rentalRequests.status,
        })
        .from(rentalRequests)
        .where(eq(rentalRequests.id, rentalData.requestId))
        .limit(1);

      // Get listing details
      const listing = await this.db.query.listings.findFirst({
        where: eq(listings.id, rentalData.listingId),
      });

      // Get listing image
      const [firstImage] = await this.db
        .select({ imageUrl: listingImages.imageUrl })
        .from(listingImages)
        .where(eq(listingImages.listingId, rentalData.listingId))
        .orderBy(listingImages.orderIndex)
        .limit(1);

      // Get renter details
      const renter = await this.db.query.user.findFirst({
        where: eq(user.id, rentalData.renterId),
      });

      // Get renter reviews and stats
      const renterReviews = await this.db.query.reviews.findMany({
        where: eq(reviews.revieweeId, rentalData.renterId),
        columns: { rating: true },
      });
      const renterRatings = renterReviews.map((r) => r.rating);
      const renterAverageRating =
        renterRatings.length > 0
          ? renterRatings.reduce((a, b) => a + b, 0) / renterRatings.length
          : 0;

      // Get renter completed rentals count
      const renterCompletedRentals = await this.db
        .select()
        .from(rentalRequests)
        .where(
          and(
            eq(rentalRequests.renterId, rentalData.renterId),
            eq(rentalRequests.status, "completed"),
          ),
        );

      // Get owner details
      const owner = await this.db.query.user.findFirst({
        where: eq(user.id, rentalData.ownerId),
      });

      // Get owner reviews
      const ownerReviews = await this.db.query.reviews.findMany({
        where: eq(reviews.revieweeId, rentalData.ownerId),
        columns: { rating: true },
      });
      const ownerRatings = ownerReviews.map((r) => r.rating);
      const ownerAverageRating =
        ownerRatings.length > 0
          ? ownerRatings.reduce((a, b) => a + b, 0) / ownerRatings.length
          : 0;

      // Get owner's primary address for pickup
      const ownerAddress = await this.db.query.userAddresses.findFirst({
        where: and(
          eq(userAddresses.userId, rentalData.ownerId),
          eq(userAddresses.isPrimary, true),
        ),
      });

      // Format pickup address
      const pickupAddress = ownerAddress
        ? `${ownerAddress.street}, ${ownerAddress.city}, ${ownerAddress.state} ${ownerAddress.zipCode}`
        : undefined;

      // Get full review if it exists
      let hasReview = false;
      let canLeaveReview = false;
      let reviewData = null;

      const { data: reviewResult } = await tryCatch(
        reviewDALInstance.getReviewByRentalId(rentalData.id),
      );

      hasReview = !!reviewResult;

      if (reviewResult) {
        reviewData = {
          id: reviewResult.id,
          rating: reviewResult.rating,
          comment: reviewResult.comment,
          title: reviewResult.title,
          accuracyRating: reviewResult.accuracyRating,
          listingConditionRating: reviewResult.listingConditionRating,
          ownerCommunicationRating: reviewResult.ownerCommunicationRating,
          createdAt: reviewResult.createdAt,
          reviewer: reviewResult.reviewer
            ? {
                id: reviewResult.reviewer.id,
                firstName: reviewResult.reviewer.firstName || "",
                lastName: reviewResult.reviewer.lastName || "",
                profileImageUrl: reviewResult.reviewer.profileImageUrl,
              }
            : null,
        };
      }

      // Can leave review if:
      // - Status is completed
      // - No damage reported
      // - No existing review
      // - User is renter
      canLeaveReview =
        userId !== undefined &&
        request[0]?.status === "completed" &&
        !rentalData.damageReported &&
        !hasReview &&
        rentalData.renterId === userId;

      return {
        id: rentalData.id,
        type: "rental",
        listingId: rentalData.listingId,
        listingName: listing?.name || "Unknown listing",
        listingImageUrl: firstImage?.imageUrl || null,
        listingBrand: listing?.brand || undefined,
        listingModel: listing?.model || undefined,
        listingCondition: listing?.condition || undefined,
        listingDescription: listing?.description || undefined,
        renterId: rentalData.renterId,
        renterName: renter
          ? `${renter.firstName} ${renter.lastName}`
          : "Unknown User",
        renterEmail: renter?.email || "",
        renterPhone: renter?.phone || undefined,
        renterProfileImage: renter?.profileImageUrl || undefined,
        renterRating:
          renterRatings.length > 0
            ? Math.round(renterAverageRating * 10) / 10
            : undefined,
        renterReviewCount: renterRatings.length || undefined,
        renterVerified: renter?.emailVerified || false,
        renterMemberSince: renter?.createdAt?.toISOString() || undefined,
        renterCompletedRentals: renterCompletedRentals.length || undefined,
        ownerId: rentalData.ownerId,
        ownerName: owner
          ? `${owner.firstName} ${owner.lastName}`
          : "Unknown User",
        ownerEmail: owner?.email || "",
        ownerPhone: owner?.phone || undefined,
        ownerProfileImage: owner?.profileImageUrl || undefined,
        ownerRating:
          ownerRatings.length > 0
            ? Math.round(ownerAverageRating * 10) / 10
            : undefined,
        ownerReviewCount: ownerRatings.length || undefined,
        ownerVerified: owner?.emailVerified || false,
        ownerMemberSince: owner?.createdAt?.toISOString() || undefined,
        startDate: rentalData.startDate,
        endDate: rentalData.endDate,
        actualStartDate: rentalData.actualStartDate || undefined,
        actualEndDate: rentalData.actualEndDate || undefined,
        totalDays: request[0]?.totalDays || 0,
        dailyRate: request[0]?.dailyRate || "0",
        totalAmount: rentalData.totalAmount,
        securityDeposit: rentalData.securityDeposit,
        deliveryRequested: request[0]?.deliveryRequested || false,
        deliveryAddress: request[0]?.deliveryAddress || undefined,
        deliveryFee: request[0]?.deliveryFee || "0",
        pickupAddress,
        setupRequested: request[0]?.setupRequested || false,
        setupFee: request[0]?.setupFee || "0",
        serviceFee: request[0]?.serviceFee || "0",
        message: request[0]?.message || undefined,
        pickupInstructions: rentalData.pickupInstructions || undefined,
        returnInstructions: rentalData.returnInstructions || undefined,
        conditionAtPickup: rentalData.conditionAtPickup || undefined,
        conditionAtReturn: rentalData.conditionAtReturn || undefined,
        damageReported: rentalData.damageReported || false,
        damageDescription: rentalData.damageDescription || undefined,
        damagePhotos: rentalData.damagePhotos || [],
        extensionRequested: rentalData.extensionRequested || false,
        extensionApproved: rentalData.extensionApproved || false,
        status: request[0]?.status || "approved",
        createdAt: rentalData.createdAt,
        currentUserId: userId || "",
        conversationId: rentalData.conversationId || null,
        hasReview,
        canLeaveReview,
        review: reviewData,
      };
    } catch (error) {
      this.handleError(error, "getRentalDetailsById");
    }
  }

  async getBookedDatesForListing(
    listingId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId?: string,
  ): Promise<Array<{ startDate: Date; endDate: Date; reason?: string }>> {
    try {
      // Get booked rentals (approved/active)
      const bookedRentals = await this.db
        .select({
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
        })
        .from(rentalRequests)
        .where(
          and(
            eq(rentalRequests.listingId, listingId),
            inArray(rentalRequests.status, ["approved", "active"]),
          ),
        )
        .orderBy(rentalRequests.startDate);

      // Get manual availability blocks
      const manualBlocks = await this.db
        .select({
          startDate: listingAvailability.startDate,
          endDate: listingAvailability.endDate,
          reason: listingAvailability.reason,
        })
        .from(listingAvailability)
        .where(
          and(
            eq(listingAvailability.listingId, listingId),
            eq(listingAvailability.isBlocked, true),
          ),
        )
        .orderBy(listingAvailability.startDate);

      // Combine both sources of blocked dates
      const allBlockedDates = [
        ...bookedRentals.map((rental) => ({
          startDate: rental.startDate,
          endDate: rental.endDate,
        })),
        ...manualBlocks.map((block) => ({
          startDate: block.startDate,
          endDate: block.endDate,
          reason: block.reason || undefined,
        })),
      ];

      return allBlockedDates;
    } catch (error) {
      this.handleError(error, "getBookedDatesForListing");
    }
  }

  /**
   * Start a rental
   * Only the owner can start their approved rentals on or after the start date
   */
  async startRental(
    rentalId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ownerId: string,
  ): Promise<{
    rental: {
      id: string;
      ownerId: string;
      renterId: string;
      listingId: string;
      status: string;
    };
    renterEmail: string;
    renterName: string;
    ownerName: string;
    listingName: string;
  }> {
    try {
      // Get the rental request to verify status
      const [request] = await this.db
        .select({
          id: rentalRequests.id,
          ownerId: rentalRequests.ownerId,
          renterId: rentalRequests.renterId,
          listingId: rentalRequests.listingId,
          status: rentalRequests.status,
          startDate: rentalRequests.startDate,
        })
        .from(rentalRequests)
        .where(eq(rentalRequests.id, rentalId))
        .limit(1);

      if (!request) {
        throw new NotFoundError("Rental request not found");
      }

      // Verify that the rental is in approved status
      if (request.status !== "approved") {
        throw new Error("Only approved rentals can be started");
      }

      // Verify that the current date is on or after the start date
      const now = new Date();
      const startDate = new Date(request.startDate);
      startDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);

      if (now < startDate) {
        throw new Error(
          "Rental cannot be started before the scheduled start date",
        );
      }

      // Update the rental_requests status to active
      await this.db
        .update(rentalRequests)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(rentalRequests.id, rentalId));

      // Update the rentals table with actual start date
      await this.db
        .update(rentals)
        .set({
          actualStartDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rentals.requestId, rentalId));

      // Update the listing status to rented
      await this.db
        .update(listings)
        .set({
          status: "rented",
          updatedAt: new Date(),
        })
        .where(eq(listings.id, request.listingId));

      // Get renter and owner details for email notification
      const [renterUser] = await this.db
        .select({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(user)
        .where(eq(user.id, request.renterId))
        .limit(1);

      const [ownerUser] = await this.db
        .select({
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(user)
        .where(eq(user.id, request.ownerId))
        .limit(1);

      const [listing] = await this.db
        .select({
          name: listings.name,
        })
        .from(listings)
        .where(eq(listings.id, request.listingId))
        .limit(1);

      if (!renterUser || !ownerUser || !listing) {
        throw new Error("Failed to fetch user or listing details");
      }

      return {
        rental: {
          id: request.id,
          ownerId: request.ownerId,
          renterId: request.renterId,
          listingId: request.listingId,
          status: "active",
        },
        renterEmail: renterUser.email,
        renterName: `${renterUser.firstName} ${renterUser.lastName}`,
        ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
        listingName: listing.name,
      };
    } catch (error) {
      this.handleError(error, "startRental");
    }
  }

  /**
   * End a rental
   * Only the owner can end their active rentals
   */
  async endRental(
    rentalId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ownerId: string,
  ): Promise<{
    rental: {
      id: string;
      ownerId: string;
      renterId: string;
      listingId: string;
      status: string;
    };
    renterEmail: string;
    renterName: string;
    ownerName: string;
    listingName: string;
  }> {
    try {
      // Get the rental request to verify status
      const [request] = await this.db
        .select({
          id: rentalRequests.id,
          ownerId: rentalRequests.ownerId,
          renterId: rentalRequests.renterId,
          listingId: rentalRequests.listingId,
          status: rentalRequests.status,
        })
        .from(rentalRequests)
        .where(eq(rentalRequests.id, rentalId))
        .limit(1);

      if (!request) {
        throw new NotFoundError("Rental request not found");
      }

      // Verify that the rental is in active status
      if (request.status !== "active") {
        throw new Error("Only active rentals can be ended");
      }

      // Update the rental_requests status to completed
      await this.db
        .update(rentalRequests)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(rentalRequests.id, rentalId));

      // Update the rentals table with actual end date
      await this.db
        .update(rentals)
        .set({
          actualEndDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rentals.requestId, rentalId));

      // Update the listing status to available
      await this.db
        .update(listings)
        .set({
          status: "available",
          updatedAt: new Date(),
        })
        .where(eq(listings.id, request.listingId));

      // Get renter and owner details for email notification
      const [renterUser] = await this.db
        .select({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(user)
        .where(eq(user.id, request.renterId))
        .limit(1);

      const [ownerUser] = await this.db
        .select({
          firstName: user.firstName,
          lastName: user.lastName,
        })
        .from(user)
        .where(eq(user.id, request.ownerId))
        .limit(1);

      const [listing] = await this.db
        .select({
          name: listings.name,
        })
        .from(listings)
        .where(eq(listings.id, request.listingId))
        .limit(1);

      if (!renterUser || !ownerUser || !listing) {
        throw new Error("Failed to fetch user or listing details");
      }

      return {
        rental: {
          id: request.id,
          ownerId: request.ownerId,
          renterId: request.renterId,
          listingId: request.listingId,
          status: "completed",
        },
        renterEmail: renterUser.email,
        renterName: `${renterUser.firstName} ${renterUser.lastName}`,
        ownerName: `${ownerUser.firstName} ${ownerUser.lastName}`,
        listingName: listing.name,
      };
    } catch (error) {
      this.handleError(error, "endRental");
    }
  }

  /**
   * Get security deposit authorization ID for a rental
   * Used for dispute financial operations
   *
   * @param rentalId - The rental ID
   * @returns The security deposit authorization ID or null
   */
  async getSecurityDepositAuthId(rentalId: string): Promise<string | null> {
    try {
      const [rental] = await this.db
        .select({
          securityDepositAuthId: rentals.securityDepositAuthId,
        })
        .from(rentals)
        .where(eq(rentals.id, rentalId))
        .limit(1);

      return rental?.securityDepositAuthId || null;
    } catch (error) {
      this.handleError(error, "getSecurityDepositAuthId");
    }
  }

  /**
   * Rental request row for pickup/return reminder cron.
   * Requirements: 13.1, 13.2, 13.3
   */
  static readonly REMINDER_LEAD_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours

  /** Rental requests due for pickup reminder (start within next window); status approved. */
  async getRentalsDueForPickupReminder(
    withinNextMs: number = RentalDAL.REMINDER_LEAD_TIME_MS,
  ): Promise<
    Array<{
      requestId: string;
      renterId: string;
      renterEmail: string;
      listingName: string;
      startDate: Date;
      endDate: Date;
    }>
  > {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + withinNextMs);
    const rows = await this.db
      .select({
        requestId: rentalRequests.id,
        renterId: rentalRequests.renterId,
        renterEmail: user.email,
        listingName: listings.name,
        startDate: rentalRequests.startDate,
        endDate: rentalRequests.endDate,
      })
      .from(rentalRequests)
      .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
      .innerJoin(user, eq(rentalRequests.renterId, user.id))
      .where(
        and(
          eq(rentalRequests.status, "approved"),
          gte(rentalRequests.startDate, now),
          lte(rentalRequests.startDate, windowEnd),
        ),
      );
    return rows;
  }

  /** Rental requests due for return reminder (end within next window); status active. */
  async getRentalsDueForReturnReminder(
    withinNextMs: number = RentalDAL.REMINDER_LEAD_TIME_MS,
  ): Promise<
    Array<{
      requestId: string;
      renterId: string;
      renterEmail: string;
      listingName: string;
      startDate: Date;
      endDate: Date;
    }>
  > {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + withinNextMs);
    const rows = await this.db
      .select({
        requestId: rentalRequests.id,
        renterId: rentalRequests.renterId,
        renterEmail: user.email,
        listingName: listings.name,
        startDate: rentalRequests.startDate,
        endDate: rentalRequests.endDate,
      })
      .from(rentalRequests)
      .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
      .innerJoin(user, eq(rentalRequests.renterId, user.id))
      .where(
        and(
          eq(rentalRequests.status, "active"),
          gte(rentalRequests.endDate, now),
          lte(rentalRequests.endDate, windowEnd),
        ),
      );
    return rows;
  }
}
