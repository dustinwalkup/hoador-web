import { eq, desc, sql, count, and, gte, lte, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import { payments } from "@/db/schemas/payments.schema";
import { rentals } from "@/db/schemas/rentals.schema";
import { listings } from "@/db/schemas/listings.schema";
import { BaseDAL } from "./base";
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
        rentalId: payment.rentalId,
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

  async createPayment(data: {
    rentalId: string;
    payerId: string;
    payeeId: string;
    amount: string;
    platformFee: string;
    paymentMethodId?: string;
    stripePaymentIntentId: string;
    status: "pending" | "succeeded" | "failed" | "refunded";
    paidAt?: Date;
    paymentType?: "rental_charge" | "security_deposit_hold";
  }): Promise<InferSelectModel<typeof payments>> {
    try {
      const [payment] = await this.db
        .insert(payments)
        .values({
          rentalId: data.rentalId,
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
