import { eq, desc, sql, count } from "drizzle-orm";
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
   * Create a payment record in the database
   * Called after a successful Stripe payment for a rental
   *
   * @param data - Payment data to create
   * @returns The created payment record
   */
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
