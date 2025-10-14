import { eq, and, inArray, sql } from "drizzle-orm";

import { rentals, rentalRequests, reviews } from "@/db/schemas/rentals.schema";
import {
  listings,
  listingImages,
  listingAvailability,
} from "@/db/schemas/listings.schema";
import { user } from "@/db/schemas/user.schema";
import { type CreateRentalRequestFormData } from "@/features/rentals/lib/form-schema";
import { getCurrentUserId } from "@/features/auth/utils/session";
import { differenceInDays } from "@/lib/utils/date.utils";
import { BaseDAL } from "./base";
import { UnauthorizedError, NotFoundError } from "./errors";

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
  deliveryFee: string;
  setupRequested?: boolean;
  setupFee?: string;
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
  | "deliveryFee"
  | "setupRequested"
  | "setupFee"
  | "selectedWindow"
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
>;
export type RentalActionsInfo = Pick<
  RentalDetails,
  "id" | "listingId" | "listingName" | "renterName" | "status"
>;
export type RentalMessagesInfo = Pick<
  RentalDetails,
  "message" | "pickupInstructions" | "returnInstructions"
>;

export class RentalDAL extends BaseDAL {
  async countBorrowedListings(userId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(rentals)
      .where(
        and(
          eq(rentals.renterId, userId),
          inArray(rentals.status, ["approved", "completed"]),
        ),
      );

    return result.length;
  }

  async countSharedListings(userId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(rentals)
      .where(
        and(
          eq(rentals.ownerId, userId),
          inArray(rentals.status, ["approved", "completed"]),
        ),
      );

    return result.length;
  }

  async getBorrowedListings(): Promise<BorrowedListingsData> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      const now = new Date();

      // Get all active and approved rentals for the user
      const allRentals = await this.db
        .select({
          id: rentals.id,
          listingId: rentals.listingId,
          listingName: listings.name,
          ownerId: rentals.ownerId,
          ownerName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          startDate: rentals.startDate,
          endDate: rentals.endDate,
          totalAmount: rentals.totalAmount,
          status: rentals.status,
          dailyRate: rentalRequests.dailyRate,
        })
        .from(rentals)
        .innerJoin(listings, eq(rentals.listingId, listings.id))
        .innerJoin(user, eq(rentals.ownerId, user.id))
        .innerJoin(rentalRequests, eq(rentals.requestId, rentalRequests.id))
        .where(
          and(
            eq(rentals.renterId, userId),
            inArray(rentals.status, ["approved", "active"]),
          ),
        )
        .orderBy(rentals.startDate);

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

  async createRentalRequest(
    formData: CreateRentalRequestFormData,
  ): Promise<{ id: string }> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get listing details to calculate pricing and validate ownership
      const listing = await this.db.query.listings.findFirst({
        where: eq(listings.id, formData.listingId),
        with: {
          owner: {
            columns: {
              id: true,
            },
          },
        },
      });

      if (!listing) {
        throw new NotFoundError("Listing", formData.listingId);
      }

      // Prevent users from renting their own listings
      if (listing.ownerId === userId) {
        throw new Error("Cannot rent your own listing");
      }

      // Calculate rental period and pricing
      const totalDays =
        differenceInDays(formData.endDate, formData.startDate) + 1;

      // Validate rental period
      if (totalDays < listing.minimumRentalPeriod) {
        throw new Error(
          `Minimum rental period is ${listing.minimumRentalPeriod} day(s)`,
        );
      }

      if (totalDays > listing.maximumRentalPeriod) {
        throw new Error(
          `Maximum rental period is ${listing.maximumRentalPeriod} days`,
        );
      }

      // Calculate rate based on rental period (apply discounts for longer rentals)
      let dailyRate = Number(listing.dailyRate);
      if (totalDays >= 30 && listing.monthlyRate) {
        dailyRate = Number(listing.monthlyRate) / 30;
      } else if (totalDays >= 7 && listing.weeklyRate) {
        dailyRate = Number(listing.weeklyRate) / 7;
      }

      const subtotal = Math.round(dailyRate * totalDays * 100) / 100;
      const deliveryFee = formData.deliveryRequested
        ? Number(listing.deliveryFee)
        : 0;
      const setupFee = formData.setupRequested
        ? Number(formData.setupFee || listing.setupFee || 0)
        : 0;
      const securityDeposit = Number(listing.securityDeposit);
      const totalAmount = subtotal + deliveryFee + setupFee;

      // Create rental request with payment information
      const [rentalRequest] = await this.db
        .insert(rentalRequests)
        .values({
          listingId: formData.listingId,
          renterId: userId,
          ownerId: listing.ownerId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          totalDays,
          dailyRate: dailyRate.toString(),
          totalAmount: totalAmount.toString(),
          securityDeposit: securityDeposit.toString(),
          deliveryRequested: formData.deliveryRequested,
          deliveryAddress: formData.deliveryAddress || null,
          deliveryFee: deliveryFee.toString(),
          setupRequested: formData.setupRequested || false,
          setupFee: setupFee.toString(),
          message: formData.message || null,
          paymentIntentId: formData.paymentIntentId || null,
          paymentMethodId: formData.paymentMethodId || null,
          status: "pending",
        })
        .returning({ id: rentalRequests.id });

      return { id: rentalRequest.id };
    } catch (error) {
      this.handleError(error, "createRentalRequest");
    }
  }

  async getRentalRequestById(requestId: string): Promise<{
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
    message: string | null;
    paymentIntentId: string | null;
    paymentMethodId: string | null;
    status: string;
    createdAt: Date;
  }> {
    try {
      // Get current user ID for security check
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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

      // Security check: only the renter or owner can view the request
      if (request.renterId !== userId && request.ownerId !== userId) {
        throw new UnauthorizedError("Access denied to this rental request");
      }

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

  async getRentalRequestsByStatus(
    status:
      | "pending"
      | "approved"
      | "active"
      | "completed"
      | "cancelled"
      | "overdue"
      | "denied",
  ): Promise<RentalRequestItem[]> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
          message: rentalRequests.message,
          deniedAt: rentalRequests.deniedAt,
          denialReason: rentalRequests.denialReason,
          approvedAt: rentalRequests.approvedAt,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .where(
          and(
            eq(rentalRequests.renterId, userId),
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
  ): Promise<LendingRequestItem[]> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
          message: rentalRequests.message,
          deniedAt: rentalRequests.deniedAt,
          denialReason: rentalRequests.denialReason,
          approvedAt: rentalRequests.approvedAt,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.renterId, user.id))
        .where(
          and(
            eq(rentalRequests.ownerId, userId),
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

  async getRentalsByStatus(
    status:
      | "pending"
      | "approved"
      | "active"
      | "completed"
      | "cancelled"
      | "overdue"
      | "denied",
  ): Promise<BorrowedListing[]> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get rentals with related data
      const rentalsList = await this.db
        .select({
          id: rentals.id,
          listingId: rentals.listingId,
          listingName: listings.name,
          ownerId: rentals.ownerId,
          ownerName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          startDate: rentals.startDate,
          endDate: rentals.endDate,
          totalAmount: rentals.totalAmount,
          status: rentals.status,
          dailyRate: rentalRequests.dailyRate,
        })
        .from(rentals)
        .innerJoin(listings, eq(rentals.listingId, listings.id))
        .innerJoin(user, eq(rentals.ownerId, user.id))
        .innerJoin(rentalRequests, eq(rentals.requestId, rentalRequests.id))
        .where(and(eq(rentals.renterId, userId), eq(rentals.status, status)))
        .orderBy(rentals.startDate);

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
  ): Promise<LendingRequestItem[]> {
    try {
      // Get current user ID
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get rentals where current user is the owner
      const rentalsList = await this.db
        .select({
          id: rentals.id,
          listingId: rentals.listingId,
          listingName: listings.name,
          renterId: rentals.renterId,
          renterName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          renterProfileImage: user.profileImageUrl,
          startDate: rentals.startDate,
          endDate: rentals.endDate,
          totalDays: rentalRequests.totalDays,
          dailyRate: rentalRequests.dailyRate,
          totalAmount: rentals.totalAmount,
          securityDeposit: rentalRequests.securityDeposit,
          status: rentals.status,
          createdAt: rentals.createdAt,
          deliveryRequested: rentalRequests.deliveryRequested,
          deliveryAddress: rentalRequests.deliveryAddress,
          deliveryFee: rentalRequests.deliveryFee,
          message: rentalRequests.message,
          deniedAt: rentalRequests.deniedAt,
          denialReason: rentalRequests.denialReason,
          approvedAt: rentalRequests.approvedAt,
        })
        .from(rentals)
        .innerJoin(listings, eq(rentals.listingId, listings.id))
        .innerJoin(user, eq(rentals.renterId, user.id))
        .innerJoin(rentalRequests, eq(rentals.requestId, rentalRequests.id))
        .where(and(eq(rentals.ownerId, userId), eq(rentals.status, status)))
        .orderBy(rentals.createdAt);

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
  async cancelRentalRequest(requestId: string, userId: string): Promise<void> {
    try {
      // First, verify the request exists and belongs to the user
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

      if (request[0].renterId !== userId) {
        throw new UnauthorizedError(
          "You can only cancel your own rental requests",
        );
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
   * Approve a rental request
   * Only the owner can approve their own pending requests
   */
  async approveRentalRequest(
    requestId: string,
    options?: {
      pickupInstructions?: string;
      returnInstructions?: string;
      rentalPaymentIntentId?: string;
      securityDepositAuthId?: string;
    },
  ): Promise<void> {
    try {
      // Get current user ID and verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get the rental request and verify ownership
      const [request] = await this.db
        .select()
        .from(rentalRequests)
        .where(eq(rentalRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new NotFoundError("Rental request not found");
      }

      // Verify that the current user is the owner of the listing
      if (request.ownerId !== userId) {
        throw new UnauthorizedError(
          "Only the listing owner can approve rental requests",
        );
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
        status: "approved",
        pickupInstructions: options?.pickupInstructions || null,
        returnInstructions: options?.returnInstructions || null,
      });
    } catch (error) {
      this.handleError(error, "approveRentalRequest");
    }
  }

  /**
   * Decline a rental request
   * Only the owner can decline their own pending requests
   */
  async declineRentalRequest(
    requestId: string,
    denialReason: string,
  ): Promise<void> {
    try {
      // Get current user ID and verify authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get the rental request and verify ownership
      const [request] = await this.db
        .select()
        .from(rentalRequests)
        .where(eq(rentalRequests.id, requestId))
        .limit(1);

      if (!request) {
        throw new NotFoundError("Rental request not found");
      }

      // Verify that the current user is the owner of the listing
      if (request.ownerId !== userId) {
        throw new UnauthorizedError(
          "Only the listing owner can decline rental requests",
        );
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
   * Get rental details by ID
   * This method handles both rental requests and actual rentals
   */
  async getRentalDetailsById(rentalId: string): Promise<RentalDetails> {
    try {
      // Get current user ID for security check
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

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
          deliveryFee: rentalRequests.deliveryFee,
          setupRequested: rentalRequests.setupRequested,
          setupFee: rentalRequests.setupFee,
          message: rentalRequests.message,
          status: rentalRequests.status,
          createdAt: rentalRequests.createdAt,
          approvedAt: rentalRequests.approvedAt,
          deniedAt: rentalRequests.deniedAt,
          denialReason: rentalRequests.denialReason,
        })
        .from(rentalRequests)
        .where(eq(rentalRequests.id, rentalId))
        .limit(1);

      if (rentalRequest.length > 0) {
        const request = rentalRequest[0];

        // Security check: only the renter or owner can view the request
        if (request.renterId !== userId && request.ownerId !== userId) {
          throw new UnauthorizedError("Access denied to this rental request");
        }

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
          .from(rentals)
          .where(
            and(
              eq(rentals.renterId, request.renterId),
              eq(rentals.status, "completed"),
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
          deliveryFee: request.deliveryFee,
          setupRequested: request.setupRequested,
          setupFee: request.setupFee,
          message: request.message || undefined,
          status: request.status,
          createdAt: request.createdAt,
          approvedAt: request.approvedAt || undefined,
          deniedAt: request.deniedAt || undefined,
          denialReason: request.denialReason || undefined,
          currentUserId: userId,
        };
      }

      // If not found as request, try as rental
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
          status: rentals.status,
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
        })
        .from(rentals)
        .where(eq(rentals.id, rentalId))
        .limit(1);

      if (rental.length === 0) {
        throw new NotFoundError("Rental", rentalId);
      }

      const rentalData = rental[0];

      // Security check: only the renter or owner can view the rental
      if (rentalData.renterId !== userId && rentalData.ownerId !== userId) {
        throw new UnauthorizedError("Access denied to this rental");
      }

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
          message: rentalRequests.message,
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
        .from(rentals)
        .where(
          and(
            eq(rentals.renterId, rentalData.renterId),
            eq(rentals.status, "completed"),
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
        setupRequested: request[0]?.setupRequested || false,
        setupFee: request[0]?.setupFee || "0",
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
        status: rentalData.status,
        createdAt: rentalData.createdAt,
        currentUserId: userId,
      };
    } catch (error) {
      this.handleError(error, "getRentalDetailsById");
    }
  }

  async getBookedDatesForListing(
    listingId: string,
  ): Promise<Array<{ startDate: Date; endDate: Date; reason?: string }>> {
    try {
      // Check authentication
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      // Get booked rentals (approved/active)
      const bookedRentals = await this.db
        .select({
          startDate: rentals.startDate,
          endDate: rentals.endDate,
        })
        .from(rentals)
        .where(
          and(
            eq(rentals.listingId, listingId),
            inArray(rentals.status, ["approved", "active"]),
          ),
        )
        .orderBy(rentals.startDate);

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
}
