import { eq, desc, sql, count, and, gte, lte, inArray, or } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import { payments } from "@/db/schemas/payments.schema";
import { rentals } from "@/db/schemas/rentals.schema";
import { listings } from "@/db/schemas/listings.schema";
import { rentalPaymentLifecycle } from "@/db/schemas/rental-payment-lifecycle.schema";
import { servicePaymentLifecycle } from "@/db/schemas/service-payment-lifecycle.schema";
import { serviceBookings, serviceListings } from "@/db/schemas/services.schema";
import { disputes } from "@/db/schemas/disputes.schema";
import { user } from "@/db/schemas/user.schema";
import {
  CHARGE_PAYMENT_TYPES,
  EARNINGS_PAYMENT_STATUSES,
  toEarningsItem,
  type EarningsItem,
  type EarningsRow,
} from "@/features/payments/lib/earnings";
import {
  toPaymentHistoryItem,
  type PaymentHistoryItem,
  type PaymentHistoryRow,
} from "@/features/payments/lib/payment-history";
import { BaseDAL } from "./base";
import { ValidationError } from "./errors";
import { type RentalPayment, type PaginatedResult } from "./types";

/**
 * Data Access Layer for payment-related operations
 */
export class PaymentDAL extends BaseDAL {
  /**
   * Get all rental payments for a user (as renter)
   * Returns payments ordered by most recent first
   *
   * @param userId - The ID of the user (renter)
   * @param options - Optional pagination options (page, limit)
   * @returns Paginated result of rental payment records with listing and rental information
   */
  async getUserRentalPayments(
    userId: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResult<RentalPayment>> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      this.validatePagination(page, limit);

      const offset = (page - 1) * limit;

      // Get total count
      const [{ value: total }] = await this.db
        .select({ value: count() })
        .from(payments)
        .innerJoin(rentals, eq(payments.rentalId, rentals.id))
        .innerJoin(listings, eq(rentals.listingId, listings.id))
        .where(eq(payments.payerId, userId));

      // Query payments joined with rentals and listings
      // Filter by payerId (the renter) matching userId
      // Order by paymentDate DESC (most recent first)
      // Use COALESCE to prefer paidAt, fallback to createdAt
      const paymentRecords = await this.db
        .select({
          id: payments.id,
          rentalId: payments.rentalId,
          listingId: rentals.listingId,
          listingName: listings.name,
          amount: payments.amount,
          status: payments.status,
          paymentDate: sql<Date>`COALESCE(${payments.paidAt}, ${payments.createdAt})`,
          rentalStartDate: rentals.startDate,
          rentalEndDate: rentals.endDate,
        })
        .from(payments)
        .innerJoin(rentals, eq(payments.rentalId, rentals.id))
        .innerJoin(listings, eq(rentals.listingId, listings.id))
        .where(eq(payments.payerId, userId))
        .orderBy(desc(sql`COALESCE(${payments.paidAt}, ${payments.createdAt})`))
        .limit(limit)
        .offset(offset);

      // Convert to RentalPayment format
      const data = paymentRecords.map((payment) => ({
        id: payment.id,
        rentalId: payment.rentalId!,
        listingId: payment.listingId,
        listingName: payment.listingName,
        amount: payment.amount,
        status: payment.status as RentalPayment["status"],
        paymentDate: payment.paymentDate,
        rentalStartDate: payment.rentalStartDate,
        rentalEndDate: payment.rentalEndDate,
      }));

      return this.createPaginatedResult(data, total, page, limit);
    } catch (error) {
      this.handleError(error, "getUserRentalPayments");
    }
  }

  /**
   * Owner earnings feed — every completed rental and service booking the user
   * was paid for, with the platform fee, net payout and transfer state.
   *
   * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md
   * § P-E7-1 (D-E7-9, D-P1…D-P8) · Requirements 13.3.1, 13.3.2
   *
   * **Why `payments` is the backbone (D-P2):** neither lifecycle table holds an
   * amount — they hold transfer/deposit *state*. The money lives here, keyed by
   * `payeeId`, so this is one query with left joins rather than a union of two.
   * `getUserPaymentHistory` is deliberately this same query from the payer side.
   *
   * **Not** an extension of `getUserRentalPayments`, which drops service
   * bookings and applies no payment-type filter; that method keeps serving its
   * existing web caller untouched.
   *
   * @param userId - The payee (owner/provider)
   * @param options - Optional pagination (page, limit)
   */
  async getUserEarnings(
    userId: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResult<EarningsItem>> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      this.validatePagination(page, limit);

      const offset = (page - 1) * limit;

      const where = and(
        eq(payments.payeeId, userId),
        inArray(payments.status, [...EARNINGS_PAYMENT_STATUSES]),
        inArray(payments.paymentType, [...CHARGE_PAYMENT_TYPES]),
      );

      // D-P1: a rental "completed" when the owner confirmed the item came back —
      // the moment that starts the review window and releases the payout. The
      // fallbacks exist only for rows predating that field.
      const rentalCompletedAt = sql<Date | null>`COALESCE(${rentals.returnConfirmedAt}, ${rentals.actualEndDate}, ${rentals.endDate})`;
      const completedAt = sql<Date | null>`COALESCE(${rentalCompletedAt}, ${serviceBookings.completedAt})`;

      const [{ value: total }] = await this.db
        .select({ value: count() })
        .from(payments)
        .where(where);

      const rows = await this.db
        .select({
          paymentId: payments.id,
          rentalId: payments.rentalId,
          serviceBookingId: payments.serviceBookingId,
          rentalTitle: listings.name,
          serviceTitle: serviceListings.title,
          // Name only — never the email. This endpoint family has leaked
          // counterparty emails before; a narrow select is the fix.
          counterpartyName: user.name,
          rentalCompletedAt,
          serviceCompletedAt: serviceBookings.completedAt,
          gross: payments.amount,
          platformFee: payments.platformFee,
          // D-P7: computed in SQL on Postgres `numeric` (exact), never in JS
          // (float). The app renders it and derives nothing.
          net: sql<string>`(${payments.amount} - ${payments.platformFee})::text`,
          rentalTransferStatus: rentalPaymentLifecycle.ownerTransferStatus,
          serviceTransferStatus: servicePaymentLifecycle.ownerTransferStatus,
          rentalTransferredAt: rentalPaymentLifecycle.ownerTransferredAt,
          serviceTransferredAt: servicePaymentLifecycle.ownerTransferredAt,
          disputeId: disputes.id,
        })
        .from(payments)
        .leftJoin(rentals, eq(payments.rentalId, rentals.id))
        .leftJoin(listings, eq(rentals.listingId, listings.id))
        .leftJoin(
          serviceBookings,
          eq(payments.serviceBookingId, serviceBookings.id),
        )
        .leftJoin(
          serviceListings,
          eq(serviceBookings.listingId, serviceListings.id),
        )
        .leftJoin(
          rentalPaymentLifecycle,
          eq(rentalPaymentLifecycle.rentalId, payments.rentalId),
        )
        .leftJoin(
          servicePaymentLifecycle,
          eq(servicePaymentLifecycle.bookingId, payments.serviceBookingId),
        )
        // A rental payment has a null serviceBookingId, so the service half of
        // this OR cannot match it (NULL = NULL is not true) and vice versa.
        .leftJoin(
          disputes,
          or(
            eq(disputes.rentalId, payments.rentalId),
            eq(disputes.serviceBookingId, payments.serviceBookingId),
          ),
        )
        .leftJoin(user, eq(user.id, payments.payerId))
        .where(where)
        .orderBy(desc(completedAt))
        .limit(limit)
        .offset(offset);

      const data = (rows as EarningsRow[]).map(toEarningsItem);

      return this.createPaginatedResult(data, total, page, limit);
    } catch (error) {
      this.handleError(error, "getUserEarnings");
    }
  }

  /**
   * Renter/requester payment history — every charge the user paid, across both
   * rentals and service bookings, with refunds and the deposit-hold state.
   *
   * Spec: hoador-mobile/specs/mobile-app/tasks/epic-07-prereq-backend-routes.md
   * § P-E7-2 (D-E7-10, D-P2, D-P3, D-P6) · Requirements 12.2.1, 12.2.2, 14.1.4
   *
   * The payer-side mirror of `getUserEarnings` — same backbone, `payerId`
   * instead of `payeeId` — with two deliberate differences:
   *
   *  - **No status filter.** A failed or refunded charge is exactly what a
   *    renter opens this screen to find; filtering to successful ones would hide
   *    the money questions people actually have.
   *  - **Deposit state joined for rentals only.** Service bookings have no
   *    deposit lifecycle (D-P6).
   *
   * Deliberately **not** an extension of `getUserRentalPayments`: that method
   * inner-joins `rentals`, so it silently drops every service-booking charge —
   * the gap this endpoint exists to close. It keeps serving its web caller as-is.
   *
   * @param userId - The payer (renter/requester)
   * @param options - Optional pagination (page, limit)
   */
  async getUserPaymentHistory(
    userId: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResult<PaymentHistoryItem>> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      this.validatePagination(page, limit);

      const offset = (page - 1) * limit;

      const where = and(
        eq(payments.payerId, userId),
        inArray(payments.paymentType, [...CHARGE_PAYMENT_TYPES]),
      );

      // Matches the convention already used by `getUserRentalPayments`: the
      // moment the renter was charged, falling back to row creation for rows
      // that never reached `paid`.
      const paymentDate = sql<Date | null>`COALESCE(${payments.paidAt}, ${payments.createdAt})`;

      const [{ value: total }] = await this.db
        .select({ value: count() })
        .from(payments)
        .where(where);

      const rows = await this.db
        .select({
          paymentId: payments.id,
          rentalId: payments.rentalId,
          serviceBookingId: payments.serviceBookingId,
          rentalTitle: listings.name,
          serviceTitle: serviceListings.title,
          // Name only — never the email.
          counterpartyName: user.name,
          date: paymentDate,
          amount: payments.amount,
          status: payments.status,
          refundAmount: payments.refundAmount,
          refundedAt: payments.refundedAt,
          refundReason: payments.refundReason,
          // Rental-only by construction: the join is on `payments.rentalId`, so
          // a service row selects NULL here and the mapper omits the key.
          depositHoldStatus: rentalPaymentLifecycle.depositHoldStatus,
        })
        .from(payments)
        .leftJoin(rentals, eq(payments.rentalId, rentals.id))
        .leftJoin(listings, eq(rentals.listingId, listings.id))
        .leftJoin(
          serviceBookings,
          eq(payments.serviceBookingId, serviceBookings.id),
        )
        .leftJoin(
          serviceListings,
          eq(serviceBookings.listingId, serviceListings.id),
        )
        .leftJoin(
          rentalPaymentLifecycle,
          eq(rentalPaymentLifecycle.rentalId, payments.rentalId),
        )
        .leftJoin(user, eq(user.id, payments.payeeId))
        .where(where)
        .orderBy(desc(paymentDate))
        .limit(limit)
        .offset(offset);

      const data = (rows as PaymentHistoryRow[]).map(toPaymentHistoryItem);

      return this.createPaginatedResult(data, total, page, limit);
    } catch (error) {
      this.handleError(error, "getUserPaymentHistory");
    }
  }

  /**
   * Get payment by rental ID
   *
   * @param rentalId - The rental ID
   * @returns The payment record or null if not found
   */
  async getByRentalId(
    rentalId: string,
  ): Promise<InferSelectModel<typeof payments> | null> {
    try {
      const [payment] = await this.db
        .select()
        .from(payments)
        .where(eq(payments.rentalId, rentalId))
        .limit(1);

      return payment || null;
    } catch (error) {
      this.handleError(error, "getByRentalId");
    }
  }

  /**
   * Get sum of earnings for a user (as payee) within a date range.
   * Used for dashboard summary (e.g. "This month earnings").
   *
   * @param userId - Payee user id
   * @param start - Start of period (inclusive)
   * @param end - End of period (inclusive)
   * @returns Sum of payment amounts in dollars (decimal); 0 if none
   */
  async getUserEarningsForMonth(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    try {
      const [row] = await this.db
        .select({
          total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.payeeId, userId),
            inArray(payments.status, ["succeeded", "completed"]),
            gte(
              sql`COALESCE(${payments.paidAt}, ${payments.createdAt})`,
              start,
            ),
            lte(sql`COALESCE(${payments.paidAt}, ${payments.createdAt})`, end),
          ),
        );

      const total = row?.total;
      return total != null ? Number(total) : 0;
    } catch (error) {
      this.handleError(error, "getUserEarningsForMonth");
    }
  }

  /**
   * Get earnings by month for the last N months (dashboard Mini-Analytics trend).
   * Returns one entry per month with amount; months with no earnings have 0.
   *
   * @param userId - Payee user id
   * @param numberOfMonths - Last N months (e.g. 6)
   * @returns Array of { year, month, monthLabel, amount } ordered by year, month asc
   */
  async getUserEarningsByMonthRange(
    userId: string,
    numberOfMonths: number,
  ): Promise<
    Array<{ year: number; month: number; monthLabel: string; amount: number }>
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
          paymentDate: sql<Date>`date_trunc('month', COALESCE(${payments.paidAt}, ${payments.createdAt}))::date`,
          total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.payeeId, userId),
            inArray(payments.status, ["succeeded", "completed"]),
            gte(
              sql`COALESCE(${payments.paidAt}, ${payments.createdAt})`,
              startBound,
            ),
          ),
        )
        .groupBy(
          sql`date_trunc('month', COALESCE(${payments.paidAt}, ${payments.createdAt}))`,
        );

      const byMonth = new Map<string, number>();
      for (const row of rows) {
        const d = new Date(row.paymentDate);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        byMonth.set(key, Number(row.total));
      }

      const result: Array<{
        year: number;
        month: number;
        monthLabel: string;
        amount: number;
      }> = [];
      for (let i = numberOfMonths - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        result.push({
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          monthLabel: d.toLocaleString("default", {
            month: "short",
            year: "2-digit",
          }),
          amount: byMonth.get(key) ?? 0,
        });
      }
      return result;
    } catch (error) {
      this.handleError(error, "getUserEarningsByMonthRange");
    }
  }

  /**
   * Create a payment record in the database
   * Called after a successful Stripe payment for a rental
   *
   * @param data - Payment data to create
   * @returns The created payment record
   */
  /**
   * Get a payment by its Stripe PaymentIntent ID
   */
  async getByPaymentIntentId(
    paymentIntentId: string,
  ): Promise<InferSelectModel<typeof payments> | null> {
    try {
      const [payment] = await this.db
        .select()
        .from(payments)
        .where(eq(payments.stripePaymentIntentId, paymentIntentId))
        .limit(1);

      return payment || null;
    } catch (error) {
      this.handleError(error, "getByPaymentIntentId");
    }
  }

  /**
   * Update a payment's status and optional fields
   */
  async updatePaymentStatus(
    paymentId: string,
    status: "pending" | "succeeded" | "failed" | "refunded",
    extra?: { paidAt?: Date },
  ): Promise<void> {
    try {
      await this.db
        .update(payments)
        .set({
          status,
          ...(extra?.paidAt && { paidAt: extra.paidAt }),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));
    } catch (error) {
      this.handleError(error, "updatePaymentStatus");
    }
  }

  /**
   * Record a refund on a payment. Updates status, refund amount, reason, and timestamp.
   *
   * @param paymentId - The payment record ID
   * @param data - Refund details (refundedAt, refundAmount as decimal string, refundReason)
   */
  async recordRefund(
    paymentId: string,
    data: {
      refundedAt: Date;
      refundAmount: string;
      refundReason: string;
    },
  ): Promise<void> {
    try {
      await this.db
        .update(payments)
        .set({
          status: "refunded",
          refundedAt: data.refundedAt,
          refundAmount: data.refundAmount,
          refundReason: data.refundReason,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));
    } catch (error) {
      this.handleError(error, "recordRefund");
    }
  }

  /**
   * Find a payment by its associated Stripe Charge ID.
   * The charge ID is stored on rental_payment_lifecycle.rentalChargeId,
   * so this joins through the lifecycle table.
   * Used by ChargebackService to identify the rental from a chargeback webhook.
   *
   * @param chargeId - Stripe Charge ID (e.g. ch_xxx)
   * @returns The payment record or null if not found
   */
  async getByChargeId(
    chargeId: string,
  ): Promise<InferSelectModel<typeof payments> | null> {
    try {
      const [payment] = await this.db
        .select({
          id: payments.id,
          rentalId: payments.rentalId,
          serviceBookingId: payments.serviceBookingId,
          payerId: payments.payerId,
          payeeId: payments.payeeId,
          amount: payments.amount,
          platformFee: payments.platformFee,
          paymentMethodId: payments.paymentMethodId,
          stripePaymentIntentId: payments.stripePaymentIntentId,
          status: payments.status,
          paymentType: payments.paymentType,
          paidAt: payments.paidAt,
          refundedAt: payments.refundedAt,
          refundAmount: payments.refundAmount,
          refundReason: payments.refundReason,
          createdAt: payments.createdAt,
          updatedAt: payments.updatedAt,
        })
        .from(payments)
        .innerJoin(
          rentalPaymentLifecycle,
          eq(payments.rentalId, rentalPaymentLifecycle.rentalId),
        )
        .where(eq(rentalPaymentLifecycle.rentalChargeId, chargeId))
        .limit(1);

      return payment ?? null;
    } catch (error) {
      this.handleError(error, "getByChargeId");
    }
  }

  async createPayment(data: {
    rentalId?: string | null;
    serviceBookingId?: string | null;
    payerId: string;
    payeeId: string;
    amount: string;
    platformFee: string;
    paymentMethodId?: string;
    stripePaymentIntentId: string;
    status: "pending" | "succeeded" | "failed" | "refunded";
    paidAt?: Date;
    paymentType?: "rental_charge" | "security_deposit_hold" | "service_charge";
  }): Promise<InferSelectModel<typeof payments>> {
    try {
      const hasRental =
        data.rentalId != null && String(data.rentalId).length > 0;
      const hasService =
        data.serviceBookingId != null &&
        String(data.serviceBookingId).length > 0;
      if (hasRental === hasService) {
        throw new ValidationError(
          "Exactly one of rentalId or serviceBookingId is required",
          "rentalId",
        );
      }

      const [payment] = await this.db
        .insert(payments)
        .values({
          rentalId: hasRental ? data.rentalId! : null,
          serviceBookingId: hasService ? data.serviceBookingId! : null,
          payerId: data.payerId,
          payeeId: data.payeeId,
          amount: data.amount,
          platformFee: data.platformFee,
          paymentMethodId: data.paymentMethodId || null,
          stripePaymentIntentId: data.stripePaymentIntentId,
          status: data.status,
          paidAt: data.paidAt || null,
          paymentType: data.paymentType ?? "rental_charge",
        })
        .returning();

      if (!payment) {
        throw new Error("Failed to create payment record");
      }

      return payment;
    } catch (error) {
      this.handleError(error, "createPayment");
    }
  }
}
