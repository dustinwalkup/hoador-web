import { and, asc, eq, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import { PLATFORM_FEE_PERCENTAGE } from "@/constants/payments";
import { servicePaymentLifecycle } from "@/db/schemas/service-payment-lifecycle.schema";
import { serviceBookings } from "@/db/schemas/services.schema";
import { user } from "@/db/schemas/user.schema";
import { BaseDAL } from "./base";

type ServicePaymentLifecycleRecord = InferSelectModel<
  typeof servicePaymentLifecycle
>;

type ServiceOwnerTransferStatus =
  ServicePaymentLifecycleRecord["ownerTransferStatus"];
type ServicePayoutStatus = ServicePaymentLifecycleRecord["payoutStatus"];

/** Row eligible for Connect transfer cron (completed booking + pending lifecycle). */
export interface PayoutEligibleServiceBooking {
  lifecycle: ServicePaymentLifecycleRecord;
  bookingId: string;
  providerId: string;
  providerConnectedAccountId: string | null;
  /** Locked provider payout in dollars (from lifecycle row). */
  providerPayout: string;
}

/** Stale processing rows for cron detection. */
export interface ServiceStaleProcessingRecord {
  bookingId: string;
  payoutStatus: string;
  updatedAt: Date;
}

/** Aggregate counts for admin dashboards. */
export interface ServicePaymentMetrics {
  payout: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  ownerTransfer: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    frozen: number;
  };
}

/** Financial KPIs for service bookings. */
export interface ServiceFinancialMetrics {
  grossVolume: string;
  platformRevenue: string;
  ownerPayouts: string;
  needsAttention: {
    failedTransfers: number;
    frozenTransfers: number;
    staleProcessing: number;
  };
}

/**
 * Data access layer for service booking payment lifecycle (provider payout pipeline).
 */
export class ServicePaymentLifecycleDAL extends BaseDAL {
  /**
   * Creates a lifecycle row when a booking is charged (provider accepts).
   */
  async create(data: {
    bookingId: string;
    chargeId: string | null;
    /** Provider net payout in dollars; locked at charge time for transfer amount. */
    providerPayout?: string | null;
    ownerTransferStatus?: ServiceOwnerTransferStatus;
    payoutStatus?: ServicePayoutStatus;
  }): Promise<ServicePaymentLifecycleRecord> {
    try {
      const [record] = await this.db
        .insert(servicePaymentLifecycle)
        .values({
          bookingId: data.bookingId,
          chargeId: data.chargeId,
          ...(data.providerPayout !== undefined
            ? { providerPayout: data.providerPayout }
            : {}),
          ownerTransferStatus: data.ownerTransferStatus ?? "pending",
          payoutStatus: data.payoutStatus ?? "pending",
        })
        .returning();

      if (!record) {
        throw new Error("Failed to create service payment lifecycle record");
      }

      return record;
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.create");
    }
  }

  /** Loads lifecycle by service booking id. */
  async getByBookingId(
    bookingId: string,
  ): Promise<ServicePaymentLifecycleRecord | null> {
    try {
      const [record] = await this.db
        .select()
        .from(servicePaymentLifecycle)
        .where(eq(servicePaymentLifecycle.bookingId, bookingId))
        .limit(1);

      return record ?? null;
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.getByBookingId");
    }
  }

  /** Lookup by Stripe transfer id (webhooks / reconciliation). */
  async getByTransferId(
    transferId: string,
  ): Promise<ServicePaymentLifecycleRecord | null> {
    try {
      const [record] = await this.db
        .select()
        .from(servicePaymentLifecycle)
        .where(eq(servicePaymentLifecycle.stripeTransferId, transferId))
        .limit(1);

      return record ?? null;
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.getByTransferId");
    }
  }

  /**
   * Atomically claims a booking for payout processing (payout pending → processing).
   */
  async claimForProcessing(bookingId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(servicePaymentLifecycle)
        .set({
          payoutStatus: "processing",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(servicePaymentLifecycle.bookingId, bookingId),
            eq(servicePaymentLifecycle.payoutStatus, "pending"),
          ),
        )
        .returning();

      return result.length > 0;
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.claimForProcessing");
    }
  }

  /** Updates owner Connect transfer status and optional Stripe ids / transfer amount. */
  async updateOwnerTransferStatus(
    bookingId: string,
    status: ServiceOwnerTransferStatus,
    extra?: {
      stripeTransferId?: string;
      ownerTransferredAt?: Date;
      /** USD amount actually transferred to the provider Connect account. */
      transferAmount?: number;
    },
  ): Promise<void> {
    try {
      await this.db
        .update(servicePaymentLifecycle)
        .set({
          ownerTransferStatus: status,
          ...(extra?.stripeTransferId != null && {
            stripeTransferId: extra.stripeTransferId,
          }),
          ...(extra?.ownerTransferredAt != null && {
            ownerTransferredAt: extra.ownerTransferredAt,
          }),
          ...(extra?.transferAmount != null && {
            transferAmount: String(extra.transferAmount),
          }),
          updatedAt: new Date(),
        })
        .where(eq(servicePaymentLifecycle.bookingId, bookingId));
    } catch (error) {
      this.handleError(
        error,
        "ServicePaymentLifecycleDAL.updateOwnerTransferStatus",
      );
    }
  }

  /** Updates payout status (e.g. terminal completed / failed). */
  async updatePayoutStatus(
    bookingId: string,
    status: ServicePayoutStatus,
  ): Promise<void> {
    try {
      await this.db
        .update(servicePaymentLifecycle)
        .set({
          payoutStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(servicePaymentLifecycle.bookingId, bookingId));
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.updatePayoutStatus");
    }
  }

  /**
   * Completed bookings past the cooldown with pending payout and non-frozen transfer.
   */
  async findEligibleForPayout(
    cutoff: Date,
    limit: number,
  ): Promise<PayoutEligibleServiceBooking[]> {
    try {
      const rows = await this.db
        .select({
          lifecycle: servicePaymentLifecycle,
          bookingId: serviceBookings.id,
          providerId: serviceBookings.providerId,
          providerConnectedAccountId: user.stripeConnectedAccountId,
        })
        .from(servicePaymentLifecycle)
        .innerJoin(
          serviceBookings,
          eq(servicePaymentLifecycle.bookingId, serviceBookings.id),
        )
        .innerJoin(user, eq(serviceBookings.providerId, user.id))
        .where(
          and(
            eq(serviceBookings.status, "completed"),
            isNotNull(serviceBookings.completedAt),
            lt(serviceBookings.completedAt, cutoff),
            eq(servicePaymentLifecycle.payoutStatus, "pending"),
            ne(servicePaymentLifecycle.ownerTransferStatus, "frozen"),
            isNotNull(servicePaymentLifecycle.providerPayout),
          ),
        )
        .orderBy(asc(serviceBookings.completedAt))
        .limit(limit);

      return rows.map((r) => ({
        lifecycle: r.lifecycle,
        bookingId: r.bookingId,
        providerId: r.providerId,
        providerPayout: String(r.lifecycle.providerPayout),
        providerConnectedAccountId: r.providerConnectedAccountId,
      }));
    } catch (error) {
      this.handleError(
        error,
        "ServicePaymentLifecycleDAL.findEligibleForPayout",
      );
    }
  }

  /**
   * Marks payout completed so cron skips (e.g. booking cancelled before payout).
   */
  async markCancelled(bookingId: string): Promise<void> {
    try {
      await this.db
        .update(servicePaymentLifecycle)
        .set({
          payoutStatus: "completed",
          updatedAt: new Date(),
        })
        .where(eq(servicePaymentLifecycle.bookingId, bookingId));
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.markCancelled");
    }
  }

  /**
   * Freezes owner transfer (e.g. dispute). Creates lifecycle if missing (edge case).
   */
  async freezeForDispute(
    bookingId: string,
  ): Promise<ServicePaymentLifecycleRecord> {
    try {
      const existing = await this.getByBookingId(bookingId);

      if (existing) {
        const [updated] = await this.db
          .update(servicePaymentLifecycle)
          .set({
            ownerTransferStatus: "frozen",
            updatedAt: new Date(),
          })
          .where(eq(servicePaymentLifecycle.bookingId, bookingId))
          .returning();

        if (!updated) {
          throw new Error("Failed to freeze service payment lifecycle");
        }
        return updated;
      }

      const [bookingRow] = await this.db
        .select({
          chargeId: serviceBookings.stripeChargeId,
          servicePrice: serviceBookings.servicePrice,
        })
        .from(serviceBookings)
        .where(eq(serviceBookings.id, bookingId))
        .limit(1);

      const providerPayout =
        bookingRow?.servicePrice != null
          ? String(
              Math.round(
                Number(bookingRow.servicePrice) *
                  (1 - PLATFORM_FEE_PERCENTAGE) *
                  100,
              ) / 100,
            )
          : null;

      return await this.create({
        bookingId,
        chargeId: bookingRow?.chargeId ?? null,
        providerPayout,
        ownerTransferStatus: "frozen",
        payoutStatus: "pending",
      });
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.freezeForDispute");
    }
  }

  /**
   * Unfreezes owner transfer after resolution (frozen → pending).
   */
  async unfreezeAfterResolution(bookingId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(servicePaymentLifecycle)
        .set({
          ownerTransferStatus: "pending",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(servicePaymentLifecycle.bookingId, bookingId),
            eq(servicePaymentLifecycle.ownerTransferStatus, "frozen"),
          ),
        )
        .returning();

      return result.length > 0;
    } catch (error) {
      this.handleError(
        error,
        "ServicePaymentLifecycleDAL.unfreezeAfterResolution",
      );
    }
  }

  /**
   * Records stuck in payout processing past threshold (stale detection cron).
   */
  async findStaleProcessingRecords(
    thresholdMinutes: number,
  ): Promise<ServiceStaleProcessingRecord[]> {
    try {
      const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);

      const rows = await this.db
        .select({
          bookingId: servicePaymentLifecycle.bookingId,
          payoutStatus: servicePaymentLifecycle.payoutStatus,
          updatedAt: servicePaymentLifecycle.updatedAt,
        })
        .from(servicePaymentLifecycle)
        .where(
          and(
            eq(servicePaymentLifecycle.payoutStatus, "processing"),
            lte(servicePaymentLifecycle.updatedAt, cutoff),
          ),
        );

      return rows.map((r) => ({
        bookingId: r.bookingId,
        payoutStatus: r.payoutStatus,
        updatedAt: r.updatedAt,
      }));
    } catch (error) {
      this.handleError(
        error,
        "ServicePaymentLifecycleDAL.findStaleProcessingRecords",
      );
    }
  }

  /** Aggregate status counts for admin dashboards. */
  async getPaymentMetrics(): Promise<ServicePaymentMetrics> {
    try {
      const [row] = await this.db
        .select({
          payoutPending: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.payoutStatus} = 'pending')::int`,
          payoutProcessing: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.payoutStatus} = 'processing')::int`,
          payoutCompleted: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.payoutStatus} = 'completed')::int`,
          payoutFailed: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.payoutStatus} = 'failed')::int`,
          transferPending: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.ownerTransferStatus} = 'pending')::int`,
          transferProcessing: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.ownerTransferStatus} = 'processing')::int`,
          transferCompleted: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.ownerTransferStatus} = 'completed')::int`,
          transferFailed: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.ownerTransferStatus} = 'failed')::int`,
          transferFrozen: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.ownerTransferStatus} = 'frozen')::int`,
        })
        .from(servicePaymentLifecycle);

      return {
        payout: {
          pending: row?.payoutPending ?? 0,
          processing: row?.payoutProcessing ?? 0,
          completed: row?.payoutCompleted ?? 0,
          failed: row?.payoutFailed ?? 0,
        },
        ownerTransfer: {
          pending: row?.transferPending ?? 0,
          processing: row?.transferProcessing ?? 0,
          completed: row?.transferCompleted ?? 0,
          failed: row?.transferFailed ?? 0,
          frozen: row?.transferFrozen ?? 0,
        },
      };
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.getPaymentMetrics");
    }
  }

  /**
   * Financial aggregates for completed service bookings in the window; needs-attention is current.
   */
  async getFinancialMetrics(days: number): Promise<ServiceFinancialMetrics> {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [financials] = await this.db
        .select({
          grossVolume: sql<string>`COALESCE(SUM(${serviceBookings.totalAmount}), 0)::text`,
          platformRevenue: sql<string>`COALESCE(SUM(${serviceBookings.serviceFee}), 0)::text`,
          ownerPayouts: sql<string>`COALESCE(SUM(${serviceBookings.servicePrice}), 0)::text`,
        })
        .from(serviceBookings)
        .where(
          and(
            eq(serviceBookings.status, "completed"),
            sql`${serviceBookings.completedAt} >= ${cutoff}`,
          ),
        );

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [attention] = await this.db
        .select({
          failedTransfers: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.ownerTransferStatus} = 'failed')::int`,
          frozenTransfers: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.ownerTransferStatus} = 'frozen')::int`,
          staleProcessing: sql<number>`COUNT(*) FILTER (WHERE ${servicePaymentLifecycle.payoutStatus} = 'processing' AND ${servicePaymentLifecycle.updatedAt} < ${oneHourAgo})::int`,
        })
        .from(servicePaymentLifecycle);

      return {
        grossVolume: financials?.grossVolume ?? "0",
        platformRevenue: financials?.platformRevenue ?? "0",
        ownerPayouts: financials?.ownerPayouts ?? "0",
        needsAttention: {
          failedTransfers: attention?.failedTransfers ?? 0,
          frozenTransfers: attention?.frozenTransfers ?? 0,
          staleProcessing: attention?.staleProcessing ?? 0,
        },
      };
    } catch (error) {
      this.handleError(error, "ServicePaymentLifecycleDAL.getFinancialMetrics");
    }
  }
}
