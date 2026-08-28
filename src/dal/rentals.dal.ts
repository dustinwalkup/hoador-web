import { eq, and, inArray, sql, gte, lte, lt, or, desc } from "drizzle-orm";
import { rentals, rentalRequests } from "@/db/schemas/rentals.schema";
import { rentalStatusEnum } from "@/db/schemas/_enums";
import {
  listings,
  listingImages,
  listingAvailability,
} from "@/db/schemas/listings.schema";
import { user, userAddresses } from "@/db/schemas/user.schema";
import { payments } from "@/db/schemas/payments.schema";
import { rentalPaymentLifecycle } from "@/db/schemas/rental-payment-lifecycle.schema";
import { conversations } from "@/db/schemas/messages.schema";
import { serviceBookings, serviceListings } from "@/db/schemas/services.schema";
import type { AlertType } from "@/features/rentals/lib/format-alert-text";
import { differenceInDays } from "@/lib/utils/date.utils";
import { isPastDay } from "@/features/rentals/lib/availability";
import { sanitizeTextWithMaxLength } from "@/lib/utils/sanitize";
import { BaseDAL } from "./base";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import type { CancellationReason } from "./types";
import { alias } from "drizzle-orm/pg-core";
import { PENDING_BOOKING_EXPIRY_WINDOW_HOURS } from "@/constants/payments";

const serviceBookingRequesterForAlerts = alias(user, "sb_req_alerts");
const serviceBookingProviderForAlerts = alias(user, "sb_prov_alerts");

/** Dashboard actionable alert (rentals + service bookings). */
export interface ActionableAlert {
  id: string;
  listingName: string;
  alertType: AlertType;
  userRole: "owner" | "renter" | "provider" | "client";
  deliveryRequested: boolean;
  daysLate?: number;
  otherPartyName: string;
  linkTo: string;
  severity: "warning" | "error";
}

/** Row for the rental-reminders cron (approved, start today or missed). */
export interface ApprovedRentalReminderRow {
  rentalRequestId: string;
  renterId: string;
  ownerId: string;
  listingName: string;
  deliveryRequested: boolean;
  startDate: Date;
  /** True when the start calendar date is strictly before the reference day. */
  isMissedStart: boolean;
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function alertSeverity(
  alertType: AlertType,
  daysLate: number,
): "warning" | "error" {
  if (alertType === "overdue_return") return "error";
  if (alertType === "not_started") return daysLate > 0 ? "error" : "warning";
  return "warning";
}

/** All data needed by CancellationService to process a cancellation or no-show. */
export interface RentalCancellationContext {
  rentalRequestId: string;
  rentalId: string;
  listingId: string;
  listingName: string;
  renterId: string;
  ownerId: string;
  status: string;
  startDate: Date;
  /** Rental price (excluding service fee) — decimal as string. */
  rentalPrice: string;
  /** Service fee — decimal as string. */
  serviceFee: string;
  /** Total charge (rental price + service fee) — decimal as string. */
  totalChargeAmount: string;
  depositHoldStatus: string | null;
  securityDepositAuthId: string | null;
  /** Stripe Charge ID from the rental payment lifecycle record. */
  rentalChargeId: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  ownerConnectedAccountId: string | null;
  ownerTransferStatus: string | null;
}

export interface BorrowedListing {
  id: string;
  listingId: string;
  listingName: string;
  listingImageUrl: string | null;
  ownerId: string;
  ownerName: string;
  ownerRating?: number;
  ownerReviewCount?: number;
  /** Whether the renter requested owner delivery (affects schedule copy). */
  deliveryRequested: boolean;
  /** Whether the owner also offered setup as part of delivery. */
  setupRequested?: boolean;
  startDate: Date;
  endDate: Date;
  totalAmount: string;
  status: string;
  dailyRate: string;
  conversationId?: string | null;
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
  ownerRating?: number;
  ownerReviewCount?: number;
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
  paymentStatus?: string | null;
  paymentFailureReason?: string | null;
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
  paymentStatus?: string | null;
  paymentFailureReason?: string | null;
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
  /**
   * Optional renter attribution context (Meta Ads). Persisted as-is on the
   * row and read back by the approval flow when emitting `Purchase` CAPI.
   */
  attributionContext?: {
    fbp?: string;
    fbc?: string;
    ip?: string;
    userAgent?: string;
    sourceUrl?: string;
  } | null;
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
  returnConfirmedAt?: Date;
  status: string;
  paymentStatus?: string | null;
  paymentFailureReason?: string | null;
  depositHoldStatus?: string | null;
  createdAt: Date;
  approvedAt?: Date;
  deniedAt?: Date;
  denialReason?: string;
  /**
   * The pending request's 72-hour deadline (`rental_requests.expires_at`), for
   * the mobile detail screen's countdown (mobile Req 9.2.3). A genuine instant,
   * unlike `startDate`/`endDate` — see the route's serialization note.
   */
  expiresAt?: Date;
  cancelledAt?: Date;
  /**
   * The owner's take, computed by `calculateRentalPricing` at request creation
   * and **stored** — never re-derived on read. `ownerPayout` is the rental price
   * (subtotal + delivery + setup) minus the 20% platform fee;
   * `applicationFeeAmount` is that platform fee PLUS the renter's service fee.
   * The mobile detail route inverts these into the owner's earnings preview
   * (mobile Req 10.1.1) so that no client does the arithmetic.
   */
  ownerPayout?: string;
  applicationFeeAmount?: string;
  currentUserId: string;
  conversationId?: string | null;
}

/**
 * What the owner records when starting a rental (mobile Req 10.2.1).
 *
 * The column has existed since the schema was written and was populated only by
 * the seed — no route ever accepted it (mobile P-E8A-6).
 */
export interface StartRentalInput {
  conditionAtPickup?: string;
}

/**
 * What the owner records when confirming a return (mobile Req 10.2.3).
 *
 * `damagePhotos` are blob URLs already uploaded via
 * `POST /api/rentals/[id]/damage-photos`; nothing here handles file bytes.
 */
export interface EndRentalInput {
  conditionAtReturn?: string;
  damageReported?: boolean;
  damageDescription?: string;
  damagePhotos?: string[];
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
  | "paymentStatus"
  | "paymentFailureReason"
  | "depositHoldStatus"
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
  | "returnConfirmedAt"
>;
export type RentalMessagesInfo = Pick<
  RentalDetails,
  "message" | "pickupInstructions" | "returnInstructions"
>;

/**
 * One rental on the unified Schedule (mobile Req 2.8), in the role the current
 * user holds. `id` is the **rental request** id — that is what `/api/rentals/[id]`
 * resolves (`getRentalDetailsById` filters on `rentalRequests.id`), so a Schedule
 * event can link straight to detail regardless of whether a `rentals` row exists
 * yet. Deliberately narrow: no money, no addresses, no counterparty email.
 */
/** The pg `rental_status` union, so a status filter cannot be a loose string. */
export type RentalStatusValue = (typeof rentalStatusEnum.enumValues)[number];

export interface ScheduleRentalRow {
  id: string;
  listingName: string;
  startDate: Date;
  endDate: Date;
  status: string;
  /** 72h response deadline; only meaningful while `status === "pending"`. */
  expiresAt: Date;
  deliveryRequested: boolean;
  setupRequested: boolean;
  role: "renter" | "owner";
  counterpartyName: string;
}

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
          deliveryRequested: rentalRequests.deliveryRequested,
          setupRequested: rentalRequests.setupRequested,
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

      if (listingIds.length > 0) {
        // Batched: single query for all listings' images, then reduce to
        // the first (lowest orderIndex) per listingId in JS. This matches
        // the prior per-listing `.orderBy(orderIndex).limit(1)` behavior
        // without issuing N round-trips.
        const imageRows = await this.db
          .select({
            listingId: listingImages.listingId,
            imageUrl: listingImages.imageUrl,
          })
          .from(listingImages)
          .where(inArray(listingImages.listingId, listingIds))
          .orderBy(listingImages.listingId, listingImages.orderIndex);

        for (const listingId of listingIds) {
          listingImagesMap.set(listingId, null);
        }
        for (const row of imageRows) {
          if (row.listingId == null) continue;
          if (listingImagesMap.get(row.listingId) == null) {
            listingImagesMap.set(row.listingId, row.imageUrl ?? null);
          }
        }
      }

      // Separate current and upcoming rentals
      const currentRentals: BorrowedListing[] = [];
      const upcomingRentals: BorrowedListing[] = [];

      for (const rental of allRentals) {
        const listingWithImage: BorrowedListing = {
          ...rental,
          listingImageUrl: listingImagesMap.get(rental.listingId) || null,
        };

        // Current rentals: started and not yet ended.
        // Normalize endDate to end-of-day so same-day rentals (endDate at midnight)
        // are not dropped after midnight.
        const endOfDay = new Date(rental.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (rental.startDate <= now && endOfDay >= now) {
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
      const expiresAt = new Date(
        Date.now() + PENDING_BOOKING_EXPIRY_WINDOW_HOURS * 60 * 60 * 1000,
      );
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
          expiresAt,
          attributionContext: payload.attributionContext ?? null,
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
    paymentStatus: string | null;
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
          paymentStatus: rentalRequests.paymentStatus,
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
   * Read the renter's Meta Ads attribution context that was captured at
   * request creation. Used by the approval flow to forward the renter's
   * fbp/fbc/ip/userAgent to the server `Purchase` CAPI event so Meta
   * attributes the conversion to the renter's original ad click — not the
   * owner who happens to be in session at approval time.
   */
  async getAttributionContext(requestId: string): Promise<{
    fbp?: string;
    fbc?: string;
    ip?: string;
    userAgent?: string;
    sourceUrl?: string;
  } | null> {
    try {
      const [row] = await this.db
        .select({ attributionContext: rentalRequests.attributionContext })
        .from(rentalRequests)
        .where(eq(rentalRequests.id, requestId))
        .limit(1);
      return row?.attributionContext ?? null;
    } catch (error) {
      this.handleError(error, "getAttributionContext");
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
          ownerReviewAggregateRating: user.reviewAggregateRating,
          ownerReviewCountRaw: user.reviewCount,
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
          paymentStatus: rentalRequests.paymentStatus,
          paymentFailureReason: rentalRequests.paymentFailureReason,
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

      // Get images for all listings in a single batched query
      const listingIds = [
        ...new Set(requests.map((request) => request.listingId)),
      ];
      const allImages =
        listingIds.length > 0
          ? await this.db
              .select({
                listingId: listingImages.listingId,
                imageUrl: listingImages.imageUrl,
              })
              .from(listingImages)
              .where(inArray(listingImages.listingId, listingIds))
              .orderBy(listingImages.listingId, listingImages.orderIndex)
          : [];

      const listingImagesMap = new Map<string, string | null>();
      for (const image of allImages) {
        if (image.listingId && !listingImagesMap.has(image.listingId)) {
          listingImagesMap.set(image.listingId, image.imageUrl);
        }
      }

      // Add listing images and owner rating to requests
      return requests.map((request) => {
        const { ownerReviewAggregateRating, ownerReviewCountRaw, ...rest } =
          request;
        const revCount = ownerReviewCountRaw ?? 0;
        const avgRating = ownerReviewAggregateRating
          ? Number(ownerReviewAggregateRating)
          : 0;
        return {
          ...rest,
          listingImageUrl: listingImagesMap.get(rest.listingId) || null,
          ownerRating:
            revCount > 0 ? Math.round(avgRating * 10) / 10 : undefined,
          ownerReviewCount: revCount || undefined,
        };
      });
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
          paymentStatus: rentalRequests.paymentStatus,
          paymentFailureReason: rentalRequests.paymentFailureReason,
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

      // Get images for all listings in a single batched query
      const listingIds = [
        ...new Set(requests.map((request) => request.listingId)),
      ];
      const allImages =
        listingIds.length > 0
          ? await this.db
              .select({
                listingId: listingImages.listingId,
                imageUrl: listingImages.imageUrl,
              })
              .from(listingImages)
              .where(inArray(listingImages.listingId, listingIds))
              .orderBy(listingImages.listingId, listingImages.orderIndex)
          : [];

      const listingImagesMap = new Map<string, string | null>();
      for (const image of allImages) {
        if (image.listingId && !listingImagesMap.has(image.listingId)) {
          listingImagesMap.set(image.listingId, image.imageUrl);
        }
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
   * Returns actionable alerts for the dashboard widget: overdue returns,
   * rentals not yet started, rentals ending today, and accepted service bookings
   * past their scheduled date.
   *
   * @param userId - Current user id
   * @returns Alerts sorted by severity (errors first), then by daysLate descending
   */
  async getActionableAlerts(userId: string): Promise<ActionableAlert[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      const startOfTomorrow = new Date(today);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      const todayYmd = toLocalYmd(today);

      // Consolidated: fetch all three rental alert categories (overdue, not
      // started, ending today) in a single query. The conditions are mutually
      // exclusive by status + date, so a SQL CASE classifies each row.
      const rentalAlertRows = await this.db
        .select({
          id: rentalRequests.id,
          listingName: listings.name,
          renterId: rentalRequests.renterId,
          ownerName:
            sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`.as(
              "owner_name",
            ),
          endDate: rentalRequests.endDate,
          startDate: rentalRequests.startDate,
          deliveryRequested: rentalRequests.deliveryRequested,
          alertCategory: sql<string>`CASE
            WHEN ${rentalRequests.endDate} < ${today}
              AND ${rentalRequests.status} IN ('approved', 'active')
              THEN 'overdue_return'
            WHEN ${rentalRequests.status} = 'approved'
              AND ${rentalRequests.startDate} <= ${endOfToday}
              AND ${rentalRequests.endDate} >= ${today}
              THEN 'not_started'
            WHEN ${rentalRequests.status} = 'active'
              AND ${rentalRequests.endDate} >= ${today}
              AND ${rentalRequests.endDate} < ${startOfTomorrow}
              THEN 'end_today'
          END`.as("alert_category"),
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
            or(
              // overdue: endDate < today AND status IN ('approved','active')
              and(
                lt(rentalRequests.endDate, today),
                inArray(rentalRequests.status, ["approved", "active"]),
              ),
              // not started: approved, start <= endOfToday, end >= today
              and(
                eq(rentalRequests.status, "approved"),
                lte(rentalRequests.startDate, endOfToday),
                gte(rentalRequests.endDate, today),
              ),
              // ending today: active, endDate in [today, startOfTomorrow)
              and(
                eq(rentalRequests.status, "active"),
                gte(rentalRequests.endDate, today),
                lt(rentalRequests.endDate, startOfTomorrow),
              ),
            ),
          ),
        );

      // Split the consolidated rows by category for downstream processing
      const overdueRows = rentalAlertRows.filter(
        (r) => r.alertCategory === "overdue_return",
      );
      const notStartedRows = rentalAlertRows.filter(
        (r) => r.alertCategory === "not_started",
      );
      const endTodayRows = rentalAlertRows.filter(
        (r) => r.alertCategory === "end_today",
      );

      const serviceRows = await this.db
        .select({
          id: serviceBookings.id,
          listingName: serviceListings.title,
          requesterId: serviceBookings.requesterId,
          providerId: serviceBookings.providerId,
          proposedDate: serviceBookings.proposedDate,
          requesterName: sql<string>`CONCAT(${serviceBookingRequesterForAlerts.firstName}, ' ', ${serviceBookingRequesterForAlerts.lastName})`,
          providerName: sql<string>`CONCAT(${serviceBookingProviderForAlerts.firstName}, ' ', ${serviceBookingProviderForAlerts.lastName})`,
        })
        .from(serviceBookings)
        .innerJoin(
          serviceListings,
          eq(serviceBookings.listingId, serviceListings.id),
        )
        .innerJoin(
          serviceBookingRequesterForAlerts,
          eq(serviceBookings.requesterId, serviceBookingRequesterForAlerts.id),
        )
        .innerJoin(
          serviceBookingProviderForAlerts,
          eq(serviceBookings.providerId, serviceBookingProviderForAlerts.id),
        )
        .where(
          and(
            or(
              eq(serviceBookings.requesterId, userId),
              eq(serviceBookings.providerId, userId),
            ),
            eq(serviceBookings.status, "accepted"),
            lt(serviceBookings.proposedDate, todayYmd),
          ),
        );

      const rentalRenterIds = [
        ...new Set(
          [...overdueRows, ...notStartedRows, ...endTodayRows].map(
            (r) => r.renterId,
          ),
        ),
      ];
      const renterNames = new Map<string, string>();
      if (rentalRenterIds.length > 0) {
        const renterRows = await this.db
          .select({
            id: user.id,
            name: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
          })
          .from(user)
          .where(inArray(user.id, rentalRenterIds));
        renterRows.forEach((r) => renterNames.set(r.id, r.name));
      }

      const alerts: ActionableAlert[] = [];

      const pushRentalAlert = (
        row: {
          id: string;
          listingName: string;
          renterId: string;
          ownerName: string;
          endDate: Date;
          startDate: Date;
          deliveryRequested: boolean;
        },
        alertType: AlertType,
      ) => {
        const isRenter = row.renterId === userId;
        const userRole = isRenter ? "renter" : "owner";
        const otherPartyName = isRenter
          ? row.ownerName
          : (renterNames.get(row.renterId) ?? "Unknown");
        const linkTo = isRenter
          ? `/dashboard/rental/${row.id}?view=renting`
          : `/dashboard/rental/${row.id}?view=lending`;

        let daysLate = 0;
        if (alertType === "overdue_return") {
          daysLate = Math.max(0, differenceInDays(today, row.endDate));
        } else if (alertType === "not_started") {
          const startMidnight = new Date(row.startDate);
          startMidnight.setHours(0, 0, 0, 0);
          daysLate =
            startMidnight < today
              ? Math.max(0, differenceInDays(today, row.startDate))
              : 0;
        }

        alerts.push({
          id: row.id,
          listingName: row.listingName,
          alertType,
          userRole,
          deliveryRequested: row.deliveryRequested,
          daysLate:
            alertType === "end_today"
              ? 0
              : alertType === "not_started" || alertType === "overdue_return"
                ? daysLate
                : undefined,
          otherPartyName,
          linkTo,
          severity: alertSeverity(alertType, daysLate),
        });
      };

      for (const row of overdueRows) {
        pushRentalAlert(row, "overdue_return");
      }
      for (const row of notStartedRows) {
        pushRentalAlert(row, "not_started");
      }
      for (const row of endTodayRows) {
        pushRentalAlert(row, "end_today");
      }

      for (const row of serviceRows) {
        const isClient = row.requesterId === userId;
        const userRole = isClient ? "client" : "provider";
        const otherPartyName = isClient ? row.providerName : row.requesterName;
        const pd =
          typeof row.proposedDate === "string"
            ? new Date(`${row.proposedDate}T12:00:00`)
            : new Date(row.proposedDate);
        const daysLate = Math.max(0, differenceInDays(today, pd));

        alerts.push({
          id: row.id,
          listingName: row.listingName,
          alertType: "service_not_completed",
          userRole,
          deliveryRequested: false,
          daysLate,
          otherPartyName,
          linkTo: `/dashboard/services/bookings/${row.id}`,
          severity: "warning",
        });
      }

      alerts.sort((a, b) => {
        const sa = a.severity === "error" ? 0 : 1;
        const sb = b.severity === "error" ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return (b.daysLate ?? 0) - (a.daysLate ?? 0);
      });

      return alerts;
    } catch (error) {
      this.handleError(error, "getActionableAlerts");
    }
  }

  /**
   * Approved rentals whose rental period should start today or should have started
   * already (missed start). Used by the rental-reminders cron route.
   *
   * @param referenceDay - Calendar day to compare against (local midnight)
   */
  async getApprovedRentalsForDailyReminders(
    referenceDay: Date,
  ): Promise<ApprovedRentalReminderRow[]> {
    try {
      const day = new Date(referenceDay);
      day.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      const startOfNext = new Date(day);
      startOfNext.setDate(startOfNext.getDate() + 1);

      const startingToday = await this.db
        .select({
          rentalRequestId: rentalRequests.id,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          listingName: listings.name,
          deliveryRequested: rentalRequests.deliveryRequested,
          startDate: rentalRequests.startDate,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .where(
          and(
            eq(rentalRequests.status, "approved"),
            gte(rentalRequests.startDate, day),
            lte(rentalRequests.startDate, endOfDay),
          ),
        );

      const missedStart = await this.db
        .select({
          rentalRequestId: rentalRequests.id,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          listingName: listings.name,
          deliveryRequested: rentalRequests.deliveryRequested,
          startDate: rentalRequests.startDate,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .where(
          and(
            eq(rentalRequests.status, "approved"),
            lt(rentalRequests.startDate, day),
          ),
        );

      return [
        ...startingToday.map((r) => ({
          ...r,
          isMissedStart: false,
        })),
        ...missedStart.map((r) => ({
          ...r,
          isMissedStart: true,
        })),
      ];
    } catch (error) {
      this.handleError(error, "getApprovedRentalsForDailyReminders");
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
          ownerReviewAggregateRating: user.reviewAggregateRating,
          ownerReviewCountRaw: user.reviewCount,
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

      // Get images for all listings in a single batched query
      const listingIds = [
        ...new Set(rentalsList.map((rental) => rental.listingId)),
      ];
      const allImages =
        listingIds.length > 0
          ? await this.db
              .select({
                listingId: listingImages.listingId,
                imageUrl: listingImages.imageUrl,
              })
              .from(listingImages)
              .where(inArray(listingImages.listingId, listingIds))
              .orderBy(listingImages.listingId, listingImages.orderIndex)
          : [];

      const listingImagesMap = new Map<string, string | null>();
      for (const image of allImages) {
        if (image.listingId && !listingImagesMap.has(image.listingId)) {
          listingImagesMap.set(image.listingId, image.imageUrl);
        }
      }

      return rentalsList.map((rental) => {
        const { ownerReviewAggregateRating, ownerReviewCountRaw, ...rest } =
          rental;
        const revCount = ownerReviewCountRaw ?? 0;
        const avgRating = ownerReviewAggregateRating
          ? Number(ownerReviewAggregateRating)
          : 0;
        return {
          ...rest,
          listingImageUrl: listingImagesMap.get(rest.listingId) || null,
          ownerRating:
            revCount > 0 ? Math.round(avgRating * 10) / 10 : undefined,
          ownerReviewCount: revCount || undefined,
        };
      });
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
          paymentStatus: rentalRequests.paymentStatus,
          paymentFailureReason: rentalRequests.paymentFailureReason,
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

      // Get images for all listings in a single batched query
      const listingIds = [
        ...new Set(rentalsList.map((rental) => rental.listingId)),
      ];
      const allImages =
        listingIds.length > 0
          ? await this.db
              .select({
                listingId: listingImages.listingId,
                imageUrl: listingImages.imageUrl,
              })
              .from(listingImages)
              .where(inArray(listingImages.listingId, listingIds))
              .orderBy(listingImages.listingId, listingImages.orderIndex)
          : [];

      const listingImagesMap = new Map<string, string | null>();
      for (const image of allImages) {
        if (image.listingId && !listingImagesMap.has(image.listingId)) {
          listingImagesMap.set(image.listingId, image.imageUrl);
        }
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
   * Returns pending rental requests whose expiresAt has passed.
   * Drives the /api/cron/expire-pending-bookings job; uses the partial
   * index `rental_requests_pending_expires_at_idx`.
   */
  async findPendingExpiredRequests(now: Date): Promise<
    Array<{
      id: string;
      renterId: string;
      ownerId: string;
      listingId: string;
      listingName: string;
      securityDepositAuthId: string | null;
    }>
  > {
    try {
      const rows = await this.db
        .select({
          id: rentalRequests.id,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          listingId: rentalRequests.listingId,
          listingName: listings.name,
          securityDepositAuthId: rentalRequests.securityDepositAuthId,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .where(
          and(
            eq(rentalRequests.status, "pending"),
            lt(rentalRequests.expiresAt, now),
          ),
        );
      return rows;
    } catch (error) {
      this.handleError(error, "findPendingExpiredRequests");
    }
  }

  /**
   * Atomically transitions a rental request to `cancelled` with
   * cancellationReason='expired_no_acceptance'. The WHERE clause guards
   * against double-expiry under concurrent cron ticks.
   *
   * @returns `true` if a row was updated, `false` if the row was no longer pending.
   */
  async markRequestExpired(requestId: string): Promise<boolean> {
    try {
      const updated = await this.db
        .update(rentalRequests)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: "expired_no_acceptance",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rentalRequests.id, requestId),
            eq(rentalRequests.status, "pending"),
          ),
        )
        .returning({ id: rentalRequests.id });
      return updated.length > 0;
    } catch (error) {
      this.handleError(error, "markRequestExpired");
    }
  }

  /**
   * Cancel a rental request
   * Only the renter can cancel their own pending requests
   */
  async cancelRentalRequest(
    requestId: string,
    _userId: string,
    cancellationNotes?: string | null,
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
          ...(cancellationNotes != null && { cancellationNotes }),
          updatedAt: new Date(),
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
   * Atomically claim a rental request for payment processing.
   * Transitions paymentStatus -> "processing" only from "pending" or "failed".
   * Returns false if another request already claimed it (or it already succeeded).
   */
  async claimRentalRequestPaymentProcessing(
    requestId: string,
  ): Promise<boolean> {
    try {
      const result = await this.db
        .update(rentalRequests)
        .set({ paymentStatus: "processing", updatedAt: new Date() })
        .where(
          and(
            eq(rentalRequests.id, requestId),
            inArray(rentalRequests.paymentStatus, ["pending", "failed"]),
          ),
        )
        .returning({ id: rentalRequests.id });
      return result.length > 0;
    } catch (error) {
      this.handleError(error, "claimRentalRequestPaymentProcessing");
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
          expiresAt: rentalRequests.expiresAt,
          cancelledAt: rentalRequests.cancelledAt,
          ownerPayout: rentalRequests.ownerPayout,
          applicationFeeAmount: rentalRequests.applicationFeeAmount,
          paymentStatus: rentalRequests.paymentStatus,
          paymentFailureReason: rentalRequests.paymentFailureReason,
          // Join with rentals table to get pickup/return instructions and actual dates if approved
          pickupInstructions: rentals.pickupInstructions,
          returnInstructions: rentals.returnInstructions,
          actualStartDate: rentals.actualStartDate,
          actualEndDate: rentals.actualEndDate,
          returnConfirmedAt: rentals.returnConfirmedAt,
          conversationId: conversations.id,
          depositHoldStatus: rentalPaymentLifecycle.depositHoldStatus,
        })
        .from(rentalRequests)
        .leftJoin(rentals, eq(rentals.requestId, rentalRequests.id))
        .leftJoin(
          rentalPaymentLifecycle,
          eq(rentalPaymentLifecycle.rentalId, rentals.id),
        )
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

        // Get renter review aggregate from user table
        const renterAverageRating = renter?.reviewAggregateRating
          ? Number(renter.reviewAggregateRating)
          : 0;
        const renterReviewCount = renter?.reviewCount ?? 0;

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

        // Get owner review aggregate
        const ownerAverageRating = owner?.reviewAggregateRating
          ? Number(owner.reviewAggregateRating)
          : 0;
        const ownerReviewCount = owner?.reviewCount ?? 0;

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
            renterReviewCount > 0
              ? Math.round(renterAverageRating * 10) / 10
              : undefined,
          renterReviewCount: renterReviewCount || undefined,
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
            ownerReviewCount > 0
              ? Math.round(ownerAverageRating * 10) / 10
              : undefined,
          ownerReviewCount: ownerReviewCount || undefined,
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
          expiresAt: request.expiresAt || undefined,
          cancelledAt: request.cancelledAt || undefined,
          ownerPayout: request.ownerPayout || undefined,
          applicationFeeAmount: request.applicationFeeAmount || undefined,
          paymentStatus: request.paymentStatus || undefined,
          paymentFailureReason: request.paymentFailureReason || undefined,
          depositHoldStatus: request.depositHoldStatus || undefined,
          actualStartDate: request.actualStartDate || undefined,
          actualEndDate: request.actualEndDate || undefined,
          returnConfirmedAt: request.returnConfirmedAt || undefined,
          currentUserId: userId || "",
          conversationId: request.conversationId || null,
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
          returnConfirmedAt: rentals.returnConfirmedAt,
          createdAt: rentals.createdAt,
          conversationId: conversations.id,
          depositHoldStatus: rentalPaymentLifecycle.depositHoldStatus,
        })
        .from(rentals)
        .leftJoin(
          rentalPaymentLifecycle,
          eq(rentalPaymentLifecycle.rentalId, rentals.id),
        )
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
          approvedAt: rentalRequests.approvedAt,
          expiresAt: rentalRequests.expiresAt,
          cancelledAt: rentalRequests.cancelledAt,
          ownerPayout: rentalRequests.ownerPayout,
          applicationFeeAmount: rentalRequests.applicationFeeAmount,
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

      // Get renter review aggregate from user table
      const renterAverageRating = renter?.reviewAggregateRating
        ? Number(renter.reviewAggregateRating)
        : 0;
      const renterReviewCount = renter?.reviewCount ?? 0;

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

      // Get owner review aggregate
      const ownerAverageRating = owner?.reviewAggregateRating
        ? Number(owner.reviewAggregateRating)
        : 0;
      const ownerReviewCount = owner?.reviewCount ?? 0;

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
          renterReviewCount > 0
            ? Math.round(renterAverageRating * 10) / 10
            : undefined,
        renterReviewCount: renterReviewCount || undefined,
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
          ownerReviewCount > 0
            ? Math.round(ownerAverageRating * 10) / 10
            : undefined,
        ownerReviewCount: ownerReviewCount || undefined,
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
        returnConfirmedAt: rentalData.returnConfirmedAt || undefined,
        status: request[0]?.status || "approved",
        approvedAt: request[0]?.approvedAt || undefined,
        expiresAt: request[0]?.expiresAt || undefined,
        cancelledAt: request[0]?.cancelledAt || undefined,
        ownerPayout: request[0]?.ownerPayout || undefined,
        applicationFeeAmount: request[0]?.applicationFeeAmount || undefined,
        depositHoldStatus: rentalData.depositHoldStatus || undefined,
        createdAt: rentalData.createdAt,
        currentUserId: userId || "",
        conversationId: rentalData.conversationId || null,
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
    _ownerId: string,
    input: StartRentalInput = {},
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

      // Mobile Req 10.2.1 — starting before the start date is blocked, and this
      // is the server enforcement that sentence promises. The docblock above has
      // claimed it since the method was written; `startDate` was even selected
      // for it, and then never read (mobile P-E8A-6). An owner could mark a
      // rental active weeks early, which starts the renter's period and flips
      // the listing to `rented` before anyone has the item.
      //
      // Compared as DAYS via `isPastDay`, so a rental starting *today* is
      // startable: its midnight `startDate` is already behind `now` by the time
      // anyone taps anything, and an instant comparison would be correct at
      // 00:00 and wrong for the rest of the day.
      const startsInFuture =
        !isPastDay(request.startDate) &&
        request.startDate.toDateString() !== new Date().toDateString();
      if (startsInFuture) {
        throw new ValidationError(
          "This rental can't be started before its start date.",
          "startDate",
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
          ...(input.conditionAtPickup !== undefined && {
            conditionAtPickup: input.conditionAtPickup,
          }),
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
    _ownerId: string,
    input: EndRentalInput = {},
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
        if (request.status === "completed") {
          throw new ConflictError(
            "Return has already been confirmed for this rental.",
          );
        }
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

      // Update the rentals table with actual end date and confirm return
      await this.db
        .update(rentals)
        .set({
          actualEndDate: new Date(),
          returnConfirmedAt: new Date(),
          ...(input.conditionAtReturn !== undefined && {
            conditionAtReturn: input.conditionAtReturn,
          }),
          ...(input.damageReported !== undefined && {
            damageReported: input.damageReported,
          }),
          ...(input.damageDescription !== undefined && {
            damageDescription: input.damageDescription,
          }),
          ...(input.damagePhotos !== undefined && {
            damagePhotos: input.damagePhotos,
          }),
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
   * Get the authorized security deposit amount (in dollars) for a rental.
   * Used to validate that partial capture amounts don't exceed the hold.
   */
  async getSecurityDepositAmount(rentalId: string): Promise<number | null> {
    try {
      const [row] = await this.db
        .select({
          securityDeposit: rentalRequests.securityDeposit,
        })
        .from(rentals)
        .innerJoin(rentalRequests, eq(rentals.requestId, rentalRequests.id))
        .where(eq(rentals.id, rentalId))
        .limit(1);

      return row?.securityDeposit != null ? Number(row.securityDeposit) : null;
    } catch (error) {
      this.handleError(error, "getSecurityDepositAmount");
    }
  }

  /**
   * Get renterId and securityDepositAuthId for a rental (e.g. admin manual deposit release).
   * Returns null if rental not found or securityDepositAuthId is null.
   */
  async getRentalDepositReleaseContext(
    rentalId: string,
  ): Promise<{ renterId: string; securityDepositAuthId: string } | null> {
    try {
      const [rental] = await this.db
        .select({
          renterId: rentals.renterId,
          securityDepositAuthId: rentals.securityDepositAuthId,
        })
        .from(rentals)
        .where(eq(rentals.id, rentalId))
        .limit(1);

      if (!rental || !rental.securityDepositAuthId || !rental.renterId) {
        return null;
      }
      return {
        renterId: rental.renterId,
        securityDepositAuthId: rental.securityDepositAuthId,
      };
    } catch (error) {
      this.handleError(error, "getRentalDepositReleaseContext");
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

  /**
   * Get full cancellation context for a rental: joins rental_requests, rentals,
   * rental_payment_lifecycle, payments, and user (owner) to return all data
   * needed by CancellationService to process a cancellation or no-show.
   *
   * @param rentalRequestId - The rental request ID
   * @returns Full context or null if not found
   */
  /**
   * Every rental **overlapping** [from, to] in which the user is renter or owner,
   * for the unified Schedule projection (mobile Req 2.8.1).
   *
   * Overlap, not containment: a rental running Aug 28 → Sep 3 belongs to BOTH
   * months, because the item is genuinely out on days in each. `startDate <= to
   * AND endDate >= from` is the standard interval-intersection predicate.
   *
   * Two queries rather than one `or(renter, owner)`: each side needs a different
   * user join to name the counterparty, and splitting them keeps both able to use
   * the renter/owner indexes. Status is NOT filtered — Schedule shows cancelled
   * and completed rentals too, distinguished by their status treatment.
   */
  async getScheduleRentals(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<ScheduleRentalRow[]> {
    try {
      const overlapsRange = and(
        lte(rentalRequests.startDate, to),
        gte(rentalRequests.endDate, from),
      );

      const asRenter = await this.db
        .select({
          id: rentalRequests.id,
          listingName: listings.name,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          status: rentalRequests.status,
          expiresAt: rentalRequests.expiresAt,
          deliveryRequested: rentalRequests.deliveryRequested,
          setupRequested: rentalRequests.setupRequested,
          counterpartyName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .where(and(eq(rentalRequests.renterId, userId), overlapsRange));

      const asOwner = await this.db
        .select({
          id: rentalRequests.id,
          listingName: listings.name,
          startDate: rentalRequests.startDate,
          endDate: rentalRequests.endDate,
          status: rentalRequests.status,
          expiresAt: rentalRequests.expiresAt,
          deliveryRequested: rentalRequests.deliveryRequested,
          setupRequested: rentalRequests.setupRequested,
          counterpartyName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
        })
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.renterId, user.id))
        .where(and(eq(rentalRequests.ownerId, userId), overlapsRange));

      return [
        ...asRenter.map((r) => ({ ...r, role: "renter" as const })),
        ...asOwner.map((r) => ({ ...r, role: "owner" as const })),
      ];
    } catch (error) {
      this.handleError(error, "getScheduleRentals");
    }
  }

  /**
   * Rentals in the given statuses, in any role, **with no date bound** — the
   * "needs your attention" source for Schedule (mobile Req 5.6.1).
   *
   * Deliberately unbounded by date: a pending request is time-critical because of
   * its 72-hour expiry, not because of when the rental starts, so one for a
   * December booking must still surface while the user is looking at August.
   * Selective on status, which is what keeps it cheap.
   */
  async getActionableRentals(
    userId: string,
    statuses: readonly RentalStatusValue[],
  ): Promise<ScheduleRentalRow[]> {
    try {
      if (statuses.length === 0) return [];
      const inStatus = inArray(rentalRequests.status, [...statuses]);

      const selection = {
        id: rentalRequests.id,
        listingName: listings.name,
        startDate: rentalRequests.startDate,
        endDate: rentalRequests.endDate,
        status: rentalRequests.status,
        expiresAt: rentalRequests.expiresAt,
        deliveryRequested: rentalRequests.deliveryRequested,
        setupRequested: rentalRequests.setupRequested,
        counterpartyName: sql<string>`CONCAT(${user.firstName}, ' ', ${user.lastName})`,
      };

      const asRenter = await this.db
        .select(selection)
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .where(and(eq(rentalRequests.renterId, userId), inStatus));

      const asOwner = await this.db
        .select(selection)
        .from(rentalRequests)
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .innerJoin(user, eq(rentalRequests.renterId, user.id))
        .where(and(eq(rentalRequests.ownerId, userId), inStatus));

      return [
        ...asRenter.map((r) => ({ ...r, role: "renter" as const })),
        ...asOwner.map((r) => ({ ...r, role: "owner" as const })),
      ];
    } catch (error) {
      this.handleError(error, "getActionableRentals");
    }
  }

  async getRentalCancellationContext(
    rentalRequestId: string,
  ): Promise<RentalCancellationContext | null> {
    try {
      const [row] = await this.db
        .select({
          rentalRequestId: rentalRequests.id,
          rentalId: rentals.id,
          listingId: rentalRequests.listingId,
          listingName: listings.name,
          renterId: rentalRequests.renterId,
          ownerId: rentalRequests.ownerId,
          status: rentalRequests.status,
          startDate: rentalRequests.startDate,
          /** Subtotal + delivery + setup (matches totalAmount − serviceFee; charged amount is totalAmount). */
          rentalPrice: sql<string>`(${rentalRequests.totalAmount}::numeric - ${rentalRequests.serviceFee}::numeric)::text`,
          serviceFee: rentalRequests.serviceFee,
          /** Same as Stripe charge / PaymentIntent amount (includes service fee once). */
          totalChargeAmount: rentalRequests.totalAmount,
          depositHoldStatus: rentalPaymentLifecycle.depositHoldStatus,
          securityDepositAuthId: rentals.securityDepositAuthId,
          rentalChargeId: rentalPaymentLifecycle.rentalChargeId,
          paymentId: payments.id,
          paymentStatus: payments.status,
          ownerConnectedAccountId: user.stripeConnectedAccountId,
          ownerTransferStatus: rentalPaymentLifecycle.ownerTransferStatus,
        })
        .from(rentalRequests)
        .innerJoin(rentals, eq(rentals.requestId, rentalRequests.id))
        .innerJoin(listings, eq(rentalRequests.listingId, listings.id))
        .leftJoin(
          rentalPaymentLifecycle,
          eq(rentalPaymentLifecycle.rentalId, rentals.id),
        )
        .leftJoin(payments, eq(payments.rentalId, rentals.id))
        .innerJoin(user, eq(rentalRequests.ownerId, user.id))
        .where(eq(rentalRequests.id, rentalRequestId))
        .limit(1);

      return row ?? null;
    } catch (error) {
      this.handleError(error, "getRentalCancellationContext");
    }
  }

  /**
   * Cancel an approved rental request with cancellation metadata.
   * Sets status to 'cancelled' and records who cancelled and why.
   * Uses a status guard (WHERE status IN ('approved')) to prevent race conditions.
   *
   * @param requestId - The rental request ID
   * @param cancelledBy - User ID of who cancelled
   * @param cancellationReason - Enum value for the reason
   * @throws Error if no rows affected (status guard failed — already cancelled or wrong status)
   */
  async cancelApprovedRental(
    requestId: string,
    cancelledBy: string,
    cancellationReason: CancellationReason,
    cancellationNotes?: string | null,
  ): Promise<void> {
    try {
      const result = await this.db
        .update(rentalRequests)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy,
          cancellationReason,
          ...(cancellationNotes != null && { cancellationNotes }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rentalRequests.id, requestId),
            eq(rentalRequests.status, "approved"),
          ),
        )
        .returning();

      if (result.length === 0) {
        throw new Error(
          "Cannot cancel rental: request not found or status is not approved",
        );
      }
    } catch (error) {
      this.handleError(error, "cancelApprovedRental");
    }
  }
}
