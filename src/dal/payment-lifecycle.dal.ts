import { alias } from "drizzle-orm/pg-core";
import {
  eq,
  and,
  sql,
  lte,
  isNull,
  inArray,
  or,
  ilike,
  desc,
  ne,
} from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import { rentalPaymentLifecycle } from "@/db/schemas/rental-payment-lifecycle.schema";
import { rentals, rentalRequests } from "@/db/schemas/rentals.schema";
import { disputes } from "@/db/schemas/disputes.schema";
import { user } from "@/db/schemas/user.schema";
import { listings } from "@/db/schemas/listings.schema";
import { auditLogs } from "@/db/schemas/audit-logs.schema";
import { BaseDAL } from "./base";
import type { PaginatedResult } from "./types";

type RentalPaymentLifecycleRecord = InferSelectModel<
  typeof rentalPaymentLifecycle
>;

type DepositHoldStatus = RentalPaymentLifecycleRecord["depositHoldStatus"];
type OwnerTransferStatus = RentalPaymentLifecycleRecord["ownerTransferStatus"];
type PayoutStatus = RentalPaymentLifecycleRecord["payoutStatus"];

/** Filters for admin lifecycle list (Phase 4 — Requirements 1.1, 1.2, 1.3, 1.6). */
export interface LifecycleListFilters {
  depositHoldStatus?: DepositHoldStatus[];
  ownerTransferStatus?: OwnerTransferStatus[];
  payoutStatus?: PayoutStatus[];
  search?: string;
  page?: number;
  limit?: number;
  excludeCompleted?: boolean;
}

/** Single row for admin lifecycle list. */
export interface LifecycleListItem {
  rentalId: string;
  rentalRequestId: string;
  renterId: string;
  ownerId: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  totalAmount: string;
  depositHoldStatus: DepositHoldStatus;
  ownerTransferStatus: OwnerTransferStatus;
  payoutStatus: PayoutStatus;
  updatedAt: Date;
}

/** Dispute summary for lifecycle detail (open disputes only). */
export interface LifecycleDisputeSummary {
  id: string;
  status: string;
  referenceNumber: number | null;
}

/** Audit log entry for lifecycle detail. */
export interface LifecycleAuditEntry {
  id: string;
  action: string;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** Full lifecycle detail for admin (Phase 4 — Requirements 2.1, 2.3). */
export interface LifecycleDetail {
  lifecycle: RentalPaymentLifecycleRecord;
  rental: {
    rentalId: string;
    startDate: Date;
    endDate: Date;
    returnConfirmedAt: Date | null;
    securityDepositAuthId: string | null;
    totalAmount: string;
    securityDeposit: string;
  };
  rentalChargeId: string | null;
  dispute: LifecycleDisputeSummary | null;
  auditLogEntries: LifecycleAuditEntry[];
}

/** Aggregate counts per status for admin metrics (Phase 4 — Requirement 3.1). */
export interface PaymentMetrics {
  payout: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  ownerTransfer: {
    pending: number;
    completed: number;
    failed: number;
    frozen: number;
  };
  depositHold: {
    scheduled: number;
    held: number;
    released: number;
    expired: number;
    failed: number;
    captured: number;
    not_applicable: number;
    release_failed: number;
  };
}

/** Financial KPIs for admin dashboard. */
export interface FinancialMetrics {
  grossVolume: string;
  platformRevenue: string;
  ownerPayouts: string;
  needsAttention: {
    failedTransfers: number;
    frozenTransfers: number;
    failedDeposits: number;
    failedReleases: number;
    expiredDeposits: number;
    staleProcessing: number;
  };
}

/** Stale processing record for cron detection (Phase 4 — Requirements 4.1, 4.5). */
export interface StaleProcessingRecord {
  rentalId: string;
  payoutStatus: string;
  updatedAt: Date;
}

/** Rental data needed for payout processing. */
export interface PayoutEligibleRental {
  lifecycle: RentalPaymentLifecycleRecord;
  rentalId: string;
  rentalRequestId: string;
  ownerId: string;
  ownerConnectedAccountId: string | null;
  totalAmount: string;
  ownerPayout: string;
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
          ownerPayout: rentalRequests.ownerPayout,
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
            or(
              eq(rentalPaymentLifecycle.depositHoldStatus, "scheduled"),
              eq(rentalPaymentLifecycle.depositHoldStatus, "failed"),
            ),
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
   * Freeze owner transfer when a dispute is filed.
   * If no lifecycle record exists (edge case), creates one with frozen status.
   *
   * @param rentalId - The rental ID to freeze
   * @returns The updated or created lifecycle record
   */
  async freezeForDispute(
    rentalId: string,
  ): Promise<RentalPaymentLifecycleRecord> {
    try {
      const existing = await this.getByRentalId(rentalId);

      if (existing) {
        const [updated] = await this.db
          .update(rentalPaymentLifecycle)
          .set({
            ownerTransferStatus: "frozen",
            updatedAt: new Date(),
          })
          .where(eq(rentalPaymentLifecycle.rentalId, rentalId))
          .returning();

        return updated;
      }

      return await this.create({
        rentalId,
        rentalChargeId: null,
        depositHoldStatus: "not_applicable",
        ownerTransferStatus: "frozen",
        payoutStatus: "pending",
      });
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.freezeForDispute");
    }
  }

  /**
   * Unfreeze owner transfer after dispute resolution and financial ops complete.
   * Atomic update: only transitions from 'frozen' → 'pending' (no-op if not frozen).
   *
   * @param rentalId - The rental ID to unfreeze
   * @returns true if a row was updated, false if nothing was frozen
   */
  async unfreezeAfterResolution(rentalId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(rentalPaymentLifecycle)
        .set({
          ownerTransferStatus: "pending",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(rentalPaymentLifecycle.rentalId, rentalId),
            eq(rentalPaymentLifecycle.ownerTransferStatus, "frozen"),
          ),
        )
        .returning();

      return result.length > 0;
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.unfreezeAfterResolution");
    }
  }

  /**
   * Mark deposit as captured after successful Stripe capture for damage.
   *
   * @param rentalId - The rental ID whose deposit was captured
   */
  async markDepositCaptured(rentalId: string): Promise<void> {
    try {
      await this.db
        .update(rentalPaymentLifecycle)
        .set({
          depositHoldStatus: "captured",
          depositCapturedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rentalPaymentLifecycle.rentalId, rentalId));
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.markDepositCaptured");
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

  /**
   * Get paginated lifecycle list for admin with filters and search (Phase 4).
   * JOINs rentals, rental_requests, users (renter + owner), listings.
   */
  async getLifecycleListForAdmin(
    filters: LifecycleListFilters,
  ): Promise<PaginatedResult<LifecycleListItem>> {
    try {
      const page = Math.max(1, filters.page ?? 1);
      const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
      this.validatePagination(page, limit);
      const offset = (page - 1) * limit;

      const renterUser = alias(user, "renter_user");
      const ownerUser = alias(user, "owner_user");

      const conditions = [];
      if (filters.depositHoldStatus?.length) {
        conditions.push(
          inArray(
            rentalPaymentLifecycle.depositHoldStatus,
            filters.depositHoldStatus,
          ),
        );
      }
      if (filters.ownerTransferStatus?.length) {
        conditions.push(
          inArray(
            rentalPaymentLifecycle.ownerTransferStatus,
            filters.ownerTransferStatus,
          ),
        );
      }
      if (filters.payoutStatus?.length) {
        conditions.push(
          inArray(rentalPaymentLifecycle.payoutStatus, filters.payoutStatus),
        );
      }
      if (filters.excludeCompleted) {
        conditions.push(
          sql`NOT (
            ${rentalPaymentLifecycle.depositHoldStatus} IN ('released', 'not_applicable', 'captured')
            AND ${rentalPaymentLifecycle.ownerTransferStatus} = 'completed'
          )`,
        );
      }
      if (filters.search?.trim()) {
        const term = `%${filters.search.trim()}%`;
        conditions.push(
          or(
            sql`${rentals.id}::text ILIKE ${term}`,
            sql`${rentals.requestId}::text ILIKE ${term}`,
            ilike(renterUser.name, term),
            ilike(ownerUser.name, term),
            ilike(listings.name, term),
          ),
        );
      }
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const countResult = await this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(rentalPaymentLifecycle)
        .innerJoin(rentals, eq(rentalPaymentLifecycle.rentalId, rentals.id))
        .innerJoin(listings, eq(rentals.listingId, listings.id))
        .innerJoin(renterUser, eq(rentals.renterId, renterUser.id))
        .innerJoin(ownerUser, eq(rentals.ownerId, ownerUser.id))
        .where(whereClause);
      const total = Number(countResult[0]?.total ?? 0);

      const rows = await this.db
        .select({
          rentalId: rentals.id,
          rentalRequestId: rentals.requestId,
          renterId: rentals.renterId,
          ownerId: rentals.ownerId,
          renterName: renterUser.name,
          ownerName: ownerUser.name,
          listingName: listings.name,
          totalAmount: rentals.totalAmount,
          depositHoldStatus: rentalPaymentLifecycle.depositHoldStatus,
          ownerTransferStatus: rentalPaymentLifecycle.ownerTransferStatus,
          payoutStatus: rentalPaymentLifecycle.payoutStatus,
          updatedAt: rentalPaymentLifecycle.updatedAt,
        })
        .from(rentalPaymentLifecycle)
        .innerJoin(rentals, eq(rentalPaymentLifecycle.rentalId, rentals.id))
        .innerJoin(listings, eq(rentals.listingId, listings.id))
        .innerJoin(renterUser, eq(rentals.renterId, renterUser.id))
        .innerJoin(ownerUser, eq(rentals.ownerId, ownerUser.id))
        .where(whereClause)
        .orderBy(desc(rentalPaymentLifecycle.updatedAt))
        .limit(limit)
        .offset(offset);

      const data: LifecycleListItem[] = rows.map((r) => ({
        rentalId: r.rentalId,
        rentalRequestId: r.rentalRequestId,
        renterId: r.renterId,
        ownerId: r.ownerId,
        renterName: r.renterName ?? "",
        ownerName: r.ownerName ?? "",
        listingName: r.listingName ?? "",
        totalAmount: String(r.totalAmount ?? "0"),
        depositHoldStatus: r.depositHoldStatus,
        ownerTransferStatus: r.ownerTransferStatus,
        payoutStatus: r.payoutStatus,
        updatedAt: r.updatedAt,
      }));

      return this.createPaginatedResult(data, total, page, limit);
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.getLifecycleListForAdmin");
    }
  }

  /**
   * Get full lifecycle detail for admin by rentalId: rental, dispute summary, audit log.
   */
  async getLifecycleDetailForAdmin(
    rentalId: string,
  ): Promise<LifecycleDetail | null> {
    try {
      const [lifecycleRow] = await this.db
        .select()
        .from(rentalPaymentLifecycle)
        .where(eq(rentalPaymentLifecycle.rentalId, rentalId))
        .limit(1);

      if (!lifecycleRow) return null;

      const [rentalRow] = await this.db
        .select({
          rentalId: rentals.id,
          startDate: rentals.startDate,
          endDate: rentals.endDate,
          returnConfirmedAt: rentals.returnConfirmedAt,
          securityDepositAuthId: rentals.securityDepositAuthId,
          totalAmount: rentals.totalAmount,
          securityDeposit: rentals.securityDeposit,
        })
        .from(rentals)
        .where(eq(rentals.id, rentalId))
        .limit(1);

      if (!rentalRow) return null;

      const [disputeRow] = await this.db
        .select({
          id: disputes.id,
          status: disputes.status,
          referenceNumber: disputes.referenceNumber,
        })
        .from(disputes)
        .where(
          and(eq(disputes.rentalId, rentalId), ne(disputes.status, "closed")),
        )
        .limit(1);

      const auditRows = await this.db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          userId: auditLogs.userId,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, "payment_lifecycle"),
            eq(auditLogs.entityId, rentalId),
          ),
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(50);

      return {
        lifecycle: lifecycleRow,
        rental: {
          rentalId: rentalRow.rentalId,
          startDate: rentalRow.startDate,
          endDate: rentalRow.endDate,
          returnConfirmedAt: rentalRow.returnConfirmedAt,
          securityDepositAuthId: rentalRow.securityDepositAuthId,
          totalAmount: String(rentalRow.totalAmount ?? "0"),
          securityDeposit: String(rentalRow.securityDeposit ?? "0"),
        },
        rentalChargeId: lifecycleRow.rentalChargeId,
        dispute: disputeRow
          ? {
              id: disputeRow.id,
              status: disputeRow.status,
              referenceNumber: disputeRow.referenceNumber,
            }
          : null,
        auditLogEntries: auditRows.map((a) => ({
          id: a.id,
          action: a.action,
          userId: a.userId,
          metadata: (a.metadata as Record<string, unknown>) ?? null,
          createdAt: a.createdAt,
        })),
      };
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.getLifecycleDetailForAdmin");
    }
  }

  /**
   * Get aggregate payment metrics (counts per status) for admin dashboard.
   */
  async getPaymentMetrics(): Promise<PaymentMetrics> {
    try {
      const [row] = await this.db
        .select({
          payoutPending: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.payoutStatus} = 'pending')::int`,
          payoutProcessing: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.payoutStatus} = 'processing')::int`,
          payoutCompleted: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.payoutStatus} = 'completed')::int`,
          payoutFailed: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.payoutStatus} = 'failed')::int`,
          transferPending: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.ownerTransferStatus} = 'pending')::int`,
          transferCompleted: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.ownerTransferStatus} = 'completed')::int`,
          transferFailed: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.ownerTransferStatus} = 'failed')::int`,
          transferFrozen: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.ownerTransferStatus} = 'frozen')::int`,
          depositScheduled: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'scheduled')::int`,
          depositHeld: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'held')::int`,
          depositReleased: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'released')::int`,
          depositExpired: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'expired')::int`,
          depositFailed: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'failed')::int`,
          depositCaptured: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'captured')::int`,
          depositNotApplicable: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'not_applicable')::int`,
          depositReleaseFailed: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'release_failed')::int`,
        })
        .from(rentalPaymentLifecycle);

      return {
        payout: {
          pending: row?.payoutPending ?? 0,
          processing: row?.payoutProcessing ?? 0,
          completed: row?.payoutCompleted ?? 0,
          failed: row?.payoutFailed ?? 0,
        },
        ownerTransfer: {
          pending: row?.transferPending ?? 0,
          completed: row?.transferCompleted ?? 0,
          failed: row?.transferFailed ?? 0,
          frozen: row?.transferFrozen ?? 0,
        },
        depositHold: {
          scheduled: row?.depositScheduled ?? 0,
          held: row?.depositHeld ?? 0,
          released: row?.depositReleased ?? 0,
          expired: row?.depositExpired ?? 0,
          failed: row?.depositFailed ?? 0,
          captured: row?.depositCaptured ?? 0,
          not_applicable: row?.depositNotApplicable ?? 0,
          release_failed: row?.depositReleaseFailed ?? 0,
        },
      };
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.getPaymentMetrics");
    }
  }

  /**
   * Get financial KPIs for admin dashboard with time period filtering.
   * Aggregates gross volume, platform revenue, and owner payouts from completed rentals.
   * "Needs attention" counts are always current (not period-filtered).
   */
  async getFinancialMetrics(days: number): Promise<FinancialMetrics> {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Financial aggregates for the period (from rentalRequests with completed status)
      const [financials] = await this.db
        .select({
          grossVolume: sql<string>`COALESCE(SUM(${rentalRequests.totalAmount}), 0)::text`,
          platformRevenue: sql<string>`COALESCE(SUM(COALESCE(${rentalRequests.applicationFeeAmount}, 0) + COALESCE(${rentalRequests.serviceFee}, 0)), 0)::text`,
          ownerPayouts: sql<string>`COALESCE(SUM(${rentalRequests.ownerPayout}), 0)::text`,
        })
        .from(rentalRequests)
        .where(
          and(
            eq(rentalRequests.status, "completed"),
            sql`${rentalRequests.updatedAt} >= ${cutoff}`,
          ),
        );

      // Needs attention counts (always current, not period-filtered)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [attention] = await this.db
        .select({
          failedTransfers: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.ownerTransferStatus} = 'failed')::int`,
          frozenTransfers: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.ownerTransferStatus} = 'frozen')::int`,
          failedDeposits: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'failed')::int`,
          failedReleases: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'release_failed')::int`,
          expiredDeposits: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.depositHoldStatus} = 'expired')::int`,
          staleProcessing: sql<number>`COUNT(*) FILTER (WHERE ${rentalPaymentLifecycle.payoutStatus} = 'processing' AND ${rentalPaymentLifecycle.updatedAt} < ${oneHourAgo})::int`,
        })
        .from(rentalPaymentLifecycle);

      return {
        grossVolume: financials?.grossVolume ?? "0",
        platformRevenue: financials?.platformRevenue ?? "0",
        ownerPayouts: financials?.ownerPayouts ?? "0",
        needsAttention: {
          failedTransfers: attention?.failedTransfers ?? 0,
          frozenTransfers: attention?.frozenTransfers ?? 0,
          failedDeposits: attention?.failedDeposits ?? 0,
          failedReleases: attention?.failedReleases ?? 0,
          expiredDeposits: attention?.expiredDeposits ?? 0,
          staleProcessing: attention?.staleProcessing ?? 0,
        },
      };
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.getFinancialMetrics");
    }
  }

  /**
   * Find records stuck in payoutStatus 'processing' longer than threshold (for stale detection cron).
   */
  async findStaleProcessingRecords(
    thresholdMinutes: number,
  ): Promise<StaleProcessingRecord[]> {
    try {
      const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      const rows = await this.db
        .select({
          rentalId: rentalPaymentLifecycle.rentalId,
          payoutStatus: rentalPaymentLifecycle.payoutStatus,
          updatedAt: rentalPaymentLifecycle.updatedAt,
        })
        .from(rentalPaymentLifecycle)
        .where(
          and(
            eq(rentalPaymentLifecycle.payoutStatus, "processing"),
            lte(rentalPaymentLifecycle.updatedAt, cutoff),
          ),
        );

      return rows;
    } catch (error) {
      this.handleError(error, "PaymentLifecycleDAL.findStaleProcessingRecords");
    }
  }
}
