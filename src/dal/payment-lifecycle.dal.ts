import { eq, and, sql, lte, isNull, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import { rentalPaymentLifecycle } from "@/db/schemas/rental-payment-lifecycle.schema";
import { rentals, rentalRequests } from "@/db/schemas/rentals.schema";
import { disputes } from "@/db/schemas/disputes.schema";
import { user } from "@/db/schemas/user.schema";
import { BaseDAL } from "./base";

type RentalPaymentLifecycleRecord = InferSelectModel<
  typeof rentalPaymentLifecycle
>;

type DepositHoldStatus = RentalPaymentLifecycleRecord["depositHoldStatus"];
type OwnerTransferStatus = RentalPaymentLifecycleRecord["ownerTransferStatus"];
type PayoutStatus = RentalPaymentLifecycleRecord["payoutStatus"];

/** Rental data needed for payout processing. */
export interface PayoutEligibleRental {
  lifecycle: RentalPaymentLifecycleRecord;
  rentalId: string;
  rentalRequestId: string;
  ownerId: string;
  ownerConnectedAccountId: string | null;
  totalAmount: string;
  securityDepositAuthId: string | null;
}

/** Rental data needed for deposit hold scheduling. */
export interface DepositScheduleRental {
  lifecycle: RentalPaymentLifecycleRecord;
  rentalId: string;
  rentalRequestId: string;
  renterId: string;
  ownerId: string;
  renterStripeCustomerId: string | null;
  renterPaymentMethodId: string | null;
  securityDeposit: string;
  listingId: string;
  startDate: Date;
}

/** Rental data needed for deposit expiry monitoring. */
export interface DepositExpiryRental {
  lifecycle: RentalPaymentLifecycleRecord;
  rentalId: string;
  securityDepositAuthId: string | null;
}

/**
 * Data Access Layer for rental payment lifecycle operations.
 */
export class PaymentLifecycleDAL extends BaseDAL {
  /** Create a lifecycle record when a rental is approved. */
  async create(data: {
    rentalId: string;
    rentalChargeId: string | null;
    depositHoldStatus: DepositHoldStatus;
    ownerTransferStatus?: OwnerTransferStatus;
    payoutStatus?: PayoutStatus;
  }): Promise<RentalPaymentLifecycleRecord> {
    try {
      const [record] = await this.db
        .insert(rentalPaymentLifecycle)
        .values({
          rentalId: data.rentalId,
          rentalChargeId: data.rentalChargeId,
          depositHoldStatus: data.depositHoldStatus,
          ownerTransferStatus: data.ownerTransferStatus ?? "pending",
          payoutStatus: data.payoutStatus ?? "pending",
        })
        .returning();

      if (!record) {
        throw new Error("Failed to create payment lifecycle record");
      }

      return record;
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.create");
    }
  }

  /** Get lifecycle record by rental ID. */
  async getByRentalId(
    rentalId: string,
  ): Promise<RentalPaymentLifecycleRecord | null> {
    try {
      const [record] = await this.db
        .select()
        .from(rentalPaymentLifecycle)
        .where(eq(rentalPaymentLifecycle.rentalId, rentalId))
        .limit(1);

      return record ?? null;
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.getByRentalId");
    }
  }

  /** Get lifecycle record by stripe transfer ID. */
  async getByTransferId(
    transferId: string,
  ): Promise<RentalPaymentLifecycleRecord | null> {
    try {
      const [record] = await this.db
        .select()
        .from(rentalPaymentLifecycle)
        .where(eq(rentalPaymentLifecycle.stripeTransferId, transferId))
        .limit(1);

      return record ?? null;
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.getByTransferId");
    }
  }

  /**
   * Atomically claim a rental for payout processing (concurrency lock).
   * Returns true if the update affected a row (claim succeeded), false otherwise.
   */
  async claimForProcessing(rentalId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(rentalPaymentLifecycle)
        .set({
          payoutStatus: "processing",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rentalPaymentLifecycle.rentalId, rentalId),
            eq(rentalPaymentLifecycle.payoutStatus, "pending"),
          ),
        )
        .returning();

      return result.length > 0;
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.claimForProcessing");
    }
  }

  /** Update deposit hold status. */
  async updateDepositHoldStatus(
    rentalId: string,
    status: DepositHoldStatus,
    extra?: { depositHoldPlacedAt?: Date; depositReleasedAt?: Date },
  ): Promise<void> {
    try {
      await this.db
        .update(rentalPaymentLifecycle)
        .set({
          depositHoldStatus: status,
          ...(extra?.depositHoldPlacedAt && {
            depositHoldPlacedAt: extra.depositHoldPlacedAt,
          }),
          ...(extra?.depositReleasedAt && {
            depositReleasedAt: extra.depositReleasedAt,
          }),
          updatedAt: new Date(),
        })
        .where(eq(rentalPaymentLifecycle.rentalId, rentalId));
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.updateDepositHoldStatus");
    }
  }

  /** Update owner transfer status. */
  async updateOwnerTransferStatus(
    rentalId: string,
    status: OwnerTransferStatus,
    extra?: { stripeTransferId?: string; ownerTransferredAt?: Date },
  ): Promise<void> {
    try {
      await this.db
        .update(rentalPaymentLifecycle)
        .set({
          ownerTransferStatus: status,
          ...(extra?.stripeTransferId && {
            stripeTransferId: extra.stripeTransferId,
          }),
          ...(extra?.ownerTransferredAt && {
            ownerTransferredAt: extra.ownerTransferredAt,
          }),
          updatedAt: new Date(),
        })
        .where(eq(rentalPaymentLifecycle.rentalId, rentalId));
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.updateOwnerTransferStatus");
    }
  }

  /** Update payout status. */
  async updatePayoutStatus(
    rentalId: string,
    status: PayoutStatus,
  ): Promise<void> {
    try {
      await this.db
        .update(rentalPaymentLifecycle)
        .set({
          payoutStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(rentalPaymentLifecycle.rentalId, rentalId));
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.updatePayoutStatus");
    }
  }

  /**
   * Find rentals eligible for payout processing.
   * Criteria: completed, returnConfirmedAt > 24hrs ago, payoutStatus = pending, no open disputes.
   */
  async findEligibleForPayout(
    limit: number = 20,
  ): Promise<PayoutEligibleRental[]> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const rows = await this.db
        .select({
          lifecycle: rentalPaymentLifecycle,
          rentalId: rentals.id,
          rentalRequestId: rentals.requestId,
          ownerId: rentals.ownerId,
          ownerConnectedAccountId: user.stripeConnectedAccountId,
          totalAmount: rentalRequests.totalAmount,
          securityDepositAuthId: rentals.securityDepositAuthId,
        })
        .from(rentalPaymentLifecycle)
        .innerJoin(rentals, eq(rentalPaymentLifecycle.rentalId, rentals.id))
        .innerJoin(rentalRequests, eq(rentals.requestId, rentalRequests.id))
        .innerJoin(user, eq(rentals.ownerId, user.id))
        .leftJoin(
          disputes,
          and(
            eq(disputes.rentalId, rentals.id),
            inArray(disputes.status, [
              "open",
              "evidence_requested",
              "under_review",
            ]),
          ),
        )
        .where(
          and(
            eq(rentalRequests.status, "completed"),
            lte(rentals.returnConfirmedAt, twentyFourHoursAgo),
            eq(rentalPaymentLifecycle.payoutStatus, "pending"),
            isNull(disputes.id),
          ),
        )
        .orderBy(rentals.returnConfirmedAt)
        .limit(limit);

      return rows;
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.findEligibleForPayout");
    }
  }

  /**
   * Find rentals with scheduled deposits approaching pickup (within 48 hours).
   */
  async findScheduledDepositsNearPickup(
    limit: number = 20,
  ): Promise<DepositScheduleRental[]> {
    try {
      const now = new Date();
      const fortyEightHoursFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const rows = await this.db
        .select({
          lifecycle: rentalPaymentLifecycle,
          rentalId: rentals.id,
          rentalRequestId: rentals.requestId,
          renterId: rentals.renterId,
          ownerId: rentals.ownerId,
          renterStripeCustomerId: user.stripeCustomerId,
          renterPaymentMethodId: rentalRequests.paymentMethodId,
          securityDeposit: rentals.securityDeposit,
          listingId: rentals.listingId,
          startDate: rentals.startDate,
        })
        .from(rentalPaymentLifecycle)
        .innerJoin(rentals, eq(rentalPaymentLifecycle.rentalId, rentals.id))
        .innerJoin(rentalRequests, eq(rentals.requestId, rentalRequests.id))
        .innerJoin(user, eq(rentals.renterId, user.id))
        .where(
          and(
            eq(rentalPaymentLifecycle.depositHoldStatus, "scheduled"),
            lte(rentals.startDate, fortyEightHoursFromNow),
            sql`${rentals.startDate} > ${now}`,
          ),
        )
        .orderBy(rentals.startDate)
        .limit(limit);

      return rows;
    } catch (error) {
      this.handleError(
        error,
        "PaymentLifecycleDAL.findScheduledDepositsNearPickup",
      );
    }
  }

  /**
   * Find rentals with deposits held longer than N days (approaching expiry).
   */
  async findExpiringDeposits(
    daysHeld: number = 6,
  ): Promise<DepositExpiryRental[]> {
    try {
      const cutoff = new Date(Date.now() - daysHeld * 24 * 60 * 60 * 1000);

      const rows = await this.db
        .select({
          lifecycle: rentalPaymentLifecycle,
          rentalId: rentals.id,
          securityDepositAuthId: rentals.securityDepositAuthId,
        })
        .from(rentalPaymentLifecycle)
        .innerJoin(rentals, eq(rentalPaymentLifecycle.rentalId, rentals.id))
        .where(
          and(
            eq(rentalPaymentLifecycle.depositHoldStatus, "held"),
            lte(rentalPaymentLifecycle.depositHoldPlacedAt, cutoff),
          ),
        )
        .limit(20);

      return rows;
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.findExpiringDeposits");
    }
  }

  /**
   * Set terminal statuses on a lifecycle record when a rental is cancelled.
   * Prevents the payout cron from picking up this rental by setting payoutStatus
   * to 'completed'. Accepts optional overrides for deposit and transfer statuses.
   *
   * @param rentalId - The rental ID
   * @param extra - Optional deposit/transfer status overrides
   */
  async markCancelled(
    rentalId: string,
    extra?: {
      depositHoldStatus?: DepositHoldStatus;
      depositReleasedAt?: Date;
      ownerTransferStatus?: OwnerTransferStatus;
      stripeTransferId?: string;
      ownerTransferredAt?: Date;
    },
  ): Promise<void> {
    try {
      await this.db
        .update(rentalPaymentLifecycle)
        .set({
          payoutStatus: "completed",
          ...(extra?.depositHoldStatus && {
            depositHoldStatus: extra.depositHoldStatus,
          }),
          ...(extra?.depositReleasedAt && {
            depositReleasedAt: extra.depositReleasedAt,
          }),
          ...(extra?.ownerTransferStatus && {
            ownerTransferStatus: extra.ownerTransferStatus,
          }),
          ...(extra?.stripeTransferId && {
            stripeTransferId: extra.stripeTransferId,
          }),
          ...(extra?.ownerTransferredAt && {
            ownerTransferredAt: extra.ownerTransferredAt,
          }),
          updatedAt: new Date(),
        })
        .where(eq(rentalPaymentLifecycle.rentalId, rentalId));
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.markCancelled");
    }
  }

  /**
   * Find failed deposits for a renter (for recovery when they update payment method).
   * Only returns deposits where the rental hasn't started yet.
   */
  async findFailedDepositsForRenter(
    renterId: string,
  ): Promise<Array<{ rentalId: string; startDate: Date }>> {
    try {
      const now = new Date();

      const rows = await this.db
        .select({
          rentalId: rentals.id,
          startDate: rentals.startDate,
        })
        .from(rentalPaymentLifecycle)
        .innerJoin(rentals, eq(rentalPaymentLifecycle.rentalId, rentals.id))
        .where(
          and(
            eq(rentalPaymentLifecycle.depositHoldStatus, "failed"),
            eq(rentals.renterId, renterId),
            sql`${rentals.startDate} > ${now}`,
          ),
        );

      return rows;
    } catch (error) {
      this.handleError(
        error,
        "PaymentLifecycleDAL.findFailedDepositsForRenter",
      );
    }
  }
}
