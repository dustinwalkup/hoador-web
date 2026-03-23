import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  lt,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  serviceBookings,
  serviceListings,
  type NewServiceBooking,
  type ServiceBooking,
} from "@/db/schemas/services.schema";
import {
  serviceNoShowReports,
  type ServiceNoShowReport,
} from "@/db/schemas/service-no-show-reports.schema";
import { user } from "@/db/schemas/user.schema";

import { BaseDAL } from "./base";
import { NotFoundError } from "./errors";

/** Insert payload for a new booking (no id / timestamps). */
export type CreateBookingData = Omit<
  NewServiceBooking,
  "id" | "createdAt" | "updatedAt"
>;

/** User summary for booking detail joins. */
export type ServiceBookingUserInfo = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  email: string;
};

/**
 * Fields required to evaluate cancellation refunds and permissions.
 */
export interface ServiceBookingCancellationContext {
  status: ServiceBooking["status"];
  proposedDate: string;
  totalAmount: string;
  stripeChargeId: string | null;
  requesterId: string;
  providerId: string;
}

/**
 * Completed booking row plus provider Stripe Connect id for payout transfer.
 */
export type PayoutEligibleBooking = ServiceBooking & {
  providerConnectedAccountId: string | null;
};

/**
 * Booking with listing and requester / provider user rows.
 */
export type ServiceBookingWithDetails = ServiceBooking & {
  listing: typeof serviceListings.$inferSelect;
  requester: ServiceBookingUserInfo;
  provider: ServiceBookingUserInfo;
};

/** Booking row for dashboard lists with listing title and counterparty summary. */
export type ServiceBookingDashboardRow = ServiceBooking & {
  listingTitle: string;
  counterparty: ServiceBookingUserInfo;
};

const bookingRequester = alias(user, "service_booking_requester");
const bookingProvider = alias(user, "service_booking_provider");

/**
 * Data access for HOA service bookings.
 */
export class ServiceBookingDAL extends BaseDAL {
  /**
   * Inserts a new booking row.
   */
  async create(data: CreateBookingData): Promise<ServiceBooking> {
    try {
      const [row] = await this.db
        .insert(serviceBookings)
        .values(data)
        .returning();

      if (!row) {
        throw new NotFoundError("Service booking");
      }

      return row;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.create");
    }
  }

  /**
   * Updates a booking and returns the updated row.
   */
  async update(
    bookingId: string,
    updates: Partial<Omit<ServiceBooking, "id" | "createdAt">>,
  ): Promise<ServiceBooking> {
    try {
      const [row] = await this.db
        .update(serviceBookings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(serviceBookings.id, bookingId))
        .returning();

      if (!row) {
        throw new NotFoundError("Service booking", bookingId);
      }

      return row;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.update");
    }
  }

  /**
   * Loads a booking with listing and requester / provider user info.
   */
  async getById(bookingId: string): Promise<ServiceBookingWithDetails | null> {
    try {
      const [row] = await this.db
        .select({
          booking: serviceBookings,
          listing: serviceListings,
          requester: {
            id: bookingRequester.id,
            firstName: bookingRequester.firstName,
            lastName: bookingRequester.lastName,
            profileImageUrl: bookingRequester.profileImageUrl,
            email: bookingRequester.email,
          },
          provider: {
            id: bookingProvider.id,
            firstName: bookingProvider.firstName,
            lastName: bookingProvider.lastName,
            profileImageUrl: bookingProvider.profileImageUrl,
            email: bookingProvider.email,
          },
        })
        .from(serviceBookings)
        .innerJoin(
          serviceListings,
          eq(serviceBookings.listingId, serviceListings.id),
        )
        .innerJoin(
          bookingRequester,
          eq(serviceBookings.requesterId, bookingRequester.id),
        )
        .innerJoin(
          bookingProvider,
          eq(serviceBookings.providerId, bookingProvider.id),
        )
        .where(eq(serviceBookings.id, bookingId))
        .limit(1);

      if (!row) {
        return null;
      }

      return {
        ...row.booking,
        listing: row.listing,
        requester: row.requester,
        provider: row.provider,
      };
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.getById");
    }
  }

  /**
   * Minimal fields for cancellation policy and Stripe refund.
   */
  async getCancellationContext(
    bookingId: string,
  ): Promise<ServiceBookingCancellationContext | null> {
    try {
      const [row] = await this.db
        .select({
          status: serviceBookings.status,
          proposedDate: serviceBookings.proposedDate,
          totalAmount: serviceBookings.totalAmount,
          stripeChargeId: serviceBookings.stripeChargeId,
          requesterId: serviceBookings.requesterId,
          providerId: serviceBookings.providerId,
        })
        .from(serviceBookings)
        .where(eq(serviceBookings.id, bookingId))
        .limit(1);

      if (!row) {
        return null;
      }

      const rawDate = row.proposedDate as unknown;
      const proposed =
        rawDate instanceof Date
          ? rawDate.toISOString().slice(0, 10)
          : String(rawDate);

      return {
        status: row.status,
        proposedDate: proposed,
        totalAmount: String(row.totalAmount),
        stripeChargeId: row.stripeChargeId,
        requesterId: row.requesterId,
        providerId: row.providerId,
      };
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.getCancellationContext");
    }
  }

  /**
   * Atomically moves payout from pending → processing for concurrency-safe cron.
   *
   * @returns true if this call claimed the row
   */
  async claimForPayoutProcessing(bookingId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(serviceBookings)
        .set({
          payoutStatus: "processing",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(serviceBookings.id, bookingId),
            eq(serviceBookings.payoutStatus, "pending"),
          ),
        )
        .returning();

      return result.length > 0;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.claimForPayoutProcessing");
    }
  }

  /**
   * Bookings eligible for provider payout: completed before cutoff, payout pending.
   */
  async findEligibleForPayout(
    cutoff: Date,
    limit: number,
  ): Promise<PayoutEligibleBooking[]> {
    try {
      const rows = await this.db
        .select({
          ...getTableColumns(serviceBookings),
          providerConnectedAccountId: user.stripeConnectedAccountId,
        })
        .from(serviceBookings)
        .innerJoin(user, eq(serviceBookings.providerId, user.id))
        .where(
          and(
            isNotNull(serviceBookings.completedAt),
            lt(serviceBookings.completedAt, cutoff),
            eq(serviceBookings.payoutStatus, "pending"),
          ),
        )
        .orderBy(asc(serviceBookings.completedAt))
        .limit(limit);

      return rows.map((row) => {
        const { providerConnectedAccountId, ...booking } = row;
        return {
          ...booking,
          providerConnectedAccountId,
        };
      });
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findEligibleForPayout");
    }
  }

  /**
   * Bookings where the user is the requester.
   */
  async findByRequester(requesterId: string): Promise<ServiceBooking[]> {
    try {
      return await this.db
        .select()
        .from(serviceBookings)
        .where(eq(serviceBookings.requesterId, requesterId))
        .orderBy(desc(serviceBookings.createdAt));
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findByRequester");
    }
  }

  /**
   * Bookings where the user is the provider.
   */
  async findByProvider(providerId: string): Promise<ServiceBooking[]> {
    try {
      return await this.db
        .select()
        .from(serviceBookings)
        .where(eq(serviceBookings.providerId, providerId))
        .orderBy(desc(serviceBookings.createdAt));
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findByProvider");
    }
  }

  /**
   * Bookings where the user is the requester, with listing title and provider as counterparty.
   */
  async findByRequesterForDashboard(
    requesterId: string,
  ): Promise<ServiceBookingDashboardRow[]> {
    try {
      const rows = await this.db
        .select({
          booking: serviceBookings,
          listingTitle: serviceListings.title,
          counterparty: {
            id: bookingProvider.id,
            firstName: bookingProvider.firstName,
            lastName: bookingProvider.lastName,
            profileImageUrl: bookingProvider.profileImageUrl,
            email: bookingProvider.email,
          },
        })
        .from(serviceBookings)
        .innerJoin(
          serviceListings,
          eq(serviceBookings.listingId, serviceListings.id),
        )
        .innerJoin(
          bookingProvider,
          eq(serviceBookings.providerId, bookingProvider.id),
        )
        .where(eq(serviceBookings.requesterId, requesterId))
        .orderBy(desc(serviceBookings.createdAt));

      return rows.map((row) => ({
        ...row.booking,
        listingTitle: row.listingTitle,
        counterparty: row.counterparty,
      }));
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findByRequesterForDashboard");
    }
  }

  /**
   * Bookings where the user is the provider, with listing title and requester as counterparty.
   */
  async findByProviderForDashboard(
    providerId: string,
  ): Promise<ServiceBookingDashboardRow[]> {
    try {
      const rows = await this.db
        .select({
          booking: serviceBookings,
          listingTitle: serviceListings.title,
          counterparty: {
            id: bookingRequester.id,
            firstName: bookingRequester.firstName,
            lastName: bookingRequester.lastName,
            profileImageUrl: bookingRequester.profileImageUrl,
            email: bookingRequester.email,
          },
        })
        .from(serviceBookings)
        .innerJoin(
          serviceListings,
          eq(serviceBookings.listingId, serviceListings.id),
        )
        .innerJoin(
          bookingRequester,
          eq(serviceBookings.requesterId, bookingRequester.id),
        )
        .where(eq(serviceBookings.providerId, providerId))
        .orderBy(desc(serviceBookings.createdAt));

      return rows.map((row) => ({
        ...row.booking,
        listingTitle: row.listingTitle,
        counterparty: row.counterparty,
      }));
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findByProviderForDashboard");
    }
  }

  /**
   * Inserts a no-show report for a service booking.
   */
  async createNoShowReport(data: {
    bookingId: string;
    reportedBy: string;
    notes?: string | null;
  }): Promise<ServiceNoShowReport> {
    try {
      const [row] = await this.db
        .insert(serviceNoShowReports)
        .values({
          bookingId: data.bookingId,
          reportedBy: data.reportedBy,
          notes: data.notes ?? null,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to create no-show report");
      }

      return row;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.createNoShowReport");
    }
  }
}
