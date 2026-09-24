import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  serviceBookings,
  serviceListings,
  type NewServiceBooking,
  type ServiceBooking,
} from "@/db/schemas/services.schema";
import { user } from "@/db/schemas/user.schema";
import { serviceBookingStatusEnum } from "@/db/schemas/_enums";
import { conversations } from "@/db/schemas/messages.schema";
import { blindReviews } from "@/db/schemas/blind-reviews.schema";
import { REVIEW_WINDOW_DAYS } from "@/features/reviews/constants";

import { BaseDAL } from "./base";
import { NotFoundError } from "./errors";
import { conversationBetween } from "./conversation-pair";

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
 * Booking with listing and requester / provider user rows.
 */
export type ServiceBookingWithDetails = ServiceBooking & {
  listing: typeof serviceListings.$inferSelect;
  requester: ServiceBookingUserInfo;
  provider: ServiceBookingUserInfo;
  /** Conversation between requester and provider, if any. */
  conversationId: string | null;
};

/** Booking row for dashboard lists with listing title and counterparty summary. */
export type ServiceBookingDashboardRow = ServiceBooking & {
  listingTitle: string;
  counterparty: ServiceBookingUserInfo;
};

export interface DashboardBookingsOptions {
  /** Newest-first row cap; omitted, every row is returned. */
  limit?: number;
}

const bookingRequester = alias(user, "service_booking_requester");
const bookingProvider = alias(user, "service_booking_provider");

/**
 * Data access for HOA service bookings.
 */
/**
 * One service booking on the unified Schedule (mobile Req 2.8), in the role the
 * current user holds. Unlike rentals these carry a real time of day, so
 * `proposedTime` survives to the client.
 *
 * `proposedDate` is a pg `date` and `proposedTime` a `varchar` — **neither
 * carries a timezone**. They are returned as the raw strings the DB holds and
 * must never be coerced to a `Date` here: doing so would stamp the server's zone
 * onto a wall-clock value (mobile D19 / Req 2.8.5).
 *
 * Deliberately narrow: no Stripe identifiers, no counterparty email — the fat
 * dashboard row (`findByRequesterForDashboard`) carries all three.
 */
/** The pg `service_booking_status` union, so a status filter stays exhaustive. */
export type ServiceBookingStatusValue =
  (typeof serviceBookingStatusEnum.enumValues)[number];

export interface ScheduleServiceBookingRow {
  id: string;
  listingTitle: string;
  /** `YYYY-MM-DD`, wall clock. */
  proposedDate: string;
  /** `HH:MM`, wall clock. */
  proposedTime: string;
  /** Nullable in the schema — a booking may have no known duration. */
  hours: string | null;
  status: string;
  expiresAt: Date;
  role: "client" | "provider";
  counterpartyName: string;
  /**
   * Set only by `getReviewableBookings` (P-E13-1): the booking is completed, the
   * 7-day blind-review window is still open, and THIS user has not submitted.
   * Not a status — see `REVIEW_ACTION_LABEL` in `build-schedule.ts`.
   */
  reviewPending?: boolean;
}

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
   * Compare-and-swap update: applies `updates` only when the booking is
   * still in `expectedStatus`. With `blockWhilePaymentProcessing`, also
   * refuses while an accept-charge claim holds paymentStatus="processing"
   * (see ServiceBookingService.acceptBooking). Returns null when the guard
   * fails — caller decides how to surface the conflict.
   */
  async updateIfStatus(
    bookingId: string,
    expectedStatus: ServiceBooking["status"],
    updates: Partial<Omit<ServiceBooking, "id" | "createdAt">>,
    opts: { blockWhilePaymentProcessing?: boolean } = {},
  ): Promise<ServiceBooking | null> {
    try {
      const conditions = [
        eq(serviceBookings.id, bookingId),
        eq(serviceBookings.status, expectedStatus),
      ];
      if (opts.blockWhilePaymentProcessing) {
        conditions.push(
          or(
            isNull(serviceBookings.paymentStatus),
            ne(serviceBookings.paymentStatus, "processing"),
          )!,
        );
      }
      const [row] = await this.db
        .update(serviceBookings)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(...conditions))
        .returning();
      return row ?? null;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.updateIfStatus");
    }
  }

  /**
   * Bookings an accept call claimed (`paymentStatus = 'processing'`) more than
   * `thresholdMinutes` ago and never released: charged and then failed to
   * persist, or failed mid-charge. Drives the detect-stale-charge-claims cron.
   */
  async findStaleProcessingBookings(
    thresholdMinutes: number,
  ): Promise<Array<{ id: string; status: string; updatedAt: Date }>> {
    try {
      const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
      return await this.db
        .select({
          id: serviceBookings.id,
          status: serviceBookings.status,
          updatedAt: serviceBookings.updatedAt,
        })
        .from(serviceBookings)
        .where(
          and(
            eq(serviceBookings.paymentStatus, "processing"),
            lte(serviceBookings.updatedAt, cutoff),
          ),
        );
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findStaleProcessingBookings");
    }
  }

  /**
   * Atomically claim a booking for payment processing.
   * Sets paymentStatus -> "processing" only when the booking is still
   * acceptable (status pending|payment_failed) and no other accept call
   * holds the claim (paymentStatus null|failed).
   * The requester must also still be an active, non-deleted account, checked
   * in the same statement so a deletion cannot land between check and claim
   * (BIZ-07).
   * Returns false when another call already claimed it or the charge
   * already succeeded.
   */
  async claimForAcceptance(bookingId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(serviceBookings)
        .set({ paymentStatus: "processing", updatedAt: new Date() })
        .where(
          and(
            eq(serviceBookings.id, bookingId),
            inArray(serviceBookings.status, ["pending", "payment_failed"]),
            or(
              isNull(serviceBookings.paymentStatus),
              eq(serviceBookings.paymentStatus, "failed"),
            ),
            sql`EXISTS (
              SELECT 1 FROM ${user} u
              WHERE u.id = ${serviceBookings.requesterId}
                AND u.anonymized_at IS NULL
                AND u.status = 'active'
            )`,
          ),
        )
        .returning({ id: serviceBookings.id });
      return result.length > 0;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.claimForAcceptance");
    }
  }

  /**
   * Returns pending service bookings whose expiresAt has passed.
   * Drives the /api/cron/expire-pending-bookings job; uses the partial
   * index `sb_pending_expires_at_idx`.
   */
  async findPendingExpired(now: Date): Promise<
    Array<{
      id: string;
      requesterId: string;
      providerId: string;
      listingId: string;
      listingTitle: string;
    }>
  > {
    try {
      const rows = await this.db
        .select({
          id: serviceBookings.id,
          requesterId: serviceBookings.requesterId,
          providerId: serviceBookings.providerId,
          listingId: serviceBookings.listingId,
          listingTitle: serviceListings.title,
        })
        .from(serviceBookings)
        .innerJoin(
          serviceListings,
          eq(serviceBookings.listingId, serviceListings.id),
        )
        .where(
          and(
            eq(serviceBookings.status, "pending"),
            lt(serviceBookings.expiresAt, now),
            // See markExpired: a claimed booking is mid-charge or charged.
            isNull(serviceBookings.paymentStatus),
          ),
        );
      return rows;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findPendingExpired");
    }
  }

  /**
   * Atomically transitions a service booking to `cancelled` with
   * cancellationReason='expired_no_acceptance'. The WHERE clause guards
   * against double-expiry under concurrent cron ticks, and skips bookings
   * an accept call has claimed (`paymentStatus` non-null — only
   * `acceptBooking` writes it). A claimed `pending` booking is mid-charge,
   * or was charged and then failed to persist; expiring it would cancel a
   * paid booking with no refund.
   *
   * @returns `true` if a row was updated, `false` if the row was no longer pending.
   */
  async markExpired(bookingId: string): Promise<boolean> {
    try {
      const updated = await this.db
        .update(serviceBookings)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: "expired_no_acceptance",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(serviceBookings.id, bookingId),
            eq(serviceBookings.status, "pending"),
            isNull(serviceBookings.paymentStatus),
          ),
        )
        .returning({ id: serviceBookings.id });
      return updated.length > 0;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.markExpired");
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
          conversationId: conversations.id,
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
        .leftJoin(
          conversations,
          conversationBetween(
            serviceBookings.requesterId,
            serviceBookings.providerId,
          ),
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
        conversationId: row.conversationId ?? null,
      };
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.getById");
    }
  }

  /**
   * Counts bookings that reference a listing.
   */
  async countByListingId(listingId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ count: count() })
        .from(serviceBookings)
        .where(eq(serviceBookings.listingId, listingId));

      return row?.count ?? 0;
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.countByListingId");
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
   * Bookings with status "payment_failed" where the user is the requester.
   * Used to notify the provider when the requester updates their payment method.
   */
  async findPaymentFailedByRequester(requesterId: string): Promise<
    Array<{
      id: string;
      providerId: string;
      listingId: string;
      selectedPaymentMethodId: string | null;
    }>
  > {
    try {
      return await this.db
        .select({
          id: serviceBookings.id,
          providerId: serviceBookings.providerId,
          listingId: serviceBookings.listingId,
          selectedPaymentMethodId: serviceBookings.selectedPaymentMethodId,
        })
        .from(serviceBookings)
        .where(
          and(
            eq(serviceBookings.requesterId, requesterId),
            eq(serviceBookings.status, "payment_failed"),
          ),
        );
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findPaymentFailedByRequester");
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
  /**
   * Every service booking scheduled within [from, to] in which the user is the
   * requester or the provider, for the unified Schedule projection (Req 2.8.1).
   *
   * A booking is a single dated appointment, so this is plain containment rather
   * than the interval overlap rentals need. `proposedDate` is a `date` column, so
   * the bounds are compared as `YYYY-MM-DD` strings — no `Date` is constructed,
   * which is what keeps the server's timezone out of a wall-clock value.
   *
   * Two queries rather than one `or(requester, provider)`: each side needs a
   * different user join to name the counterparty.
   */
  async getScheduleBookings(
    userId: string,
    fromDay: string,
    toDay: string,
  ): Promise<ScheduleServiceBookingRow[]> {
    try {
      const withinRange = and(
        gte(serviceBookings.proposedDate, fromDay),
        lte(serviceBookings.proposedDate, toDay),
      );

      const selection = {
        id: serviceBookings.id,
        listingTitle: serviceListings.title,
        proposedDate: serviceBookings.proposedDate,
        proposedTime: serviceBookings.proposedTime,
        hours: serviceBookings.hours,
        status: serviceBookings.status,
        expiresAt: serviceBookings.expiresAt,
      };

      const asClient = await this.db
        .select({
          ...selection,
          counterpartyName: sql<string>`CONCAT(${bookingProvider.firstName}, ' ', ${bookingProvider.lastName})`,
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
        .where(and(eq(serviceBookings.requesterId, userId), withinRange));

      const asProvider = await this.db
        .select({
          ...selection,
          counterpartyName: sql<string>`CONCAT(${bookingRequester.firstName}, ' ', ${bookingRequester.lastName})`,
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
        .where(and(eq(serviceBookings.providerId, userId), withinRange));

      return [
        ...asClient.map((b) => ({ ...b, role: "client" as const })),
        ...asProvider.map((b) => ({ ...b, role: "provider" as const })),
      ];
    } catch (error) {
      this.handleError(error, "getScheduleBookings");
    }
  }

  /**
   * Bookings in the given statuses, in either role, **with no date bound** — the
   * service half of Schedule's "needs your attention" (mobile Req 5.6.1). See
   * `RentalDAL.getActionableRentals` for why this is not range-scoped.
   */
  async getActionableBookings(
    userId: string,
    statuses: readonly ServiceBookingStatusValue[],
  ): Promise<ScheduleServiceBookingRow[]> {
    try {
      if (statuses.length === 0) return [];
      const inStatus = inArray(serviceBookings.status, [...statuses]);

      const selection = {
        id: serviceBookings.id,
        listingTitle: serviceListings.title,
        proposedDate: serviceBookings.proposedDate,
        proposedTime: serviceBookings.proposedTime,
        hours: serviceBookings.hours,
        status: serviceBookings.status,
        expiresAt: serviceBookings.expiresAt,
      };

      const asClient = await this.db
        .select({
          ...selection,
          counterpartyName: sql<string>`CONCAT(${bookingProvider.firstName}, ' ', ${bookingProvider.lastName})`,
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
        .where(and(eq(serviceBookings.requesterId, userId), inStatus));

      const asProvider = await this.db
        .select({
          ...selection,
          counterpartyName: sql<string>`CONCAT(${bookingRequester.firstName}, ' ', ${bookingRequester.lastName})`,
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
        .where(and(eq(serviceBookings.providerId, userId), inStatus));

      return [
        ...asClient.map((b) => ({ ...b, role: "client" as const })),
        ...asProvider.map((b) => ({ ...b, role: "provider" as const })),
      ];
    } catch (error) {
      this.handleError(error, "getActionableBookings");
    }
  }

  /**
   * Completed service bookings this user still owes a review on (P-E13-1).
   *
   * The service-side twin of `rentalDAL.getReviewableRentals`. Simpler in one
   * way — a booking has one id across its whole lifecycle, so the NOT EXISTS
   * keys on the same id the schedule event carries — and identical in the rest:
   * `completed` **with** a `completed_at` (the reviews service refuses a booking
   * without one), inside the 7-day window, and unreviewed *by this user*.
   */
  async getReviewableBookings(
    userId: string,
  ): Promise<ScheduleServiceBookingRow[]> {
    try {
      const selection = {
        id: serviceBookings.id,
        listingTitle: serviceListings.title,
        proposedDate: serviceBookings.proposedDate,
        proposedTime: serviceBookings.proposedTime,
        hours: serviceBookings.hours,
        status: serviceBookings.status,
        expiresAt: serviceBookings.expiresAt,
      };

      const base = and(
        eq(serviceBookings.status, "completed"),
        isNotNull(serviceBookings.completedAt),
        sql`now() <= ${serviceBookings.completedAt} + make_interval(days => ${REVIEW_WINDOW_DAYS})`,
        notExists(
          this.db
            .select({ one: sql`1` })
            .from(blindReviews)
            .where(
              and(
                eq(blindReviews.serviceBookingId, serviceBookings.id),
                eq(blindReviews.reviewerId, userId),
              ),
            ),
        ),
      );

      const asClient = await this.db
        .select({
          ...selection,
          counterpartyName: sql<string>`CONCAT(${bookingProvider.firstName}, ' ', ${bookingProvider.lastName})`,
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
        .where(and(eq(serviceBookings.requesterId, userId), base));

      const asProvider = await this.db
        .select({
          ...selection,
          counterpartyName: sql<string>`CONCAT(${bookingRequester.firstName}, ' ', ${bookingRequester.lastName})`,
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
        .where(and(eq(serviceBookings.providerId, userId), base));

      return [
        ...asClient.map((b) => ({
          ...b,
          role: "client" as const,
          reviewPending: true,
        })),
        ...asProvider.map((b) => ({
          ...b,
          role: "provider" as const,
          reviewPending: true,
        })),
      ];
    } catch (error) {
      this.handleError(error, "getReviewableBookings");
    }
  }

  /**
   * Bookings where the user is the requester, with listing title and provider
   * as counterparty, newest first. Unbounded unless `options.limit` is given:
   * the bookings list page and `GET /api/services/bookings` need every row,
   * while the dashboard only needs recent ones (PERF-01).
   */
  async findByRequesterForDashboard(
    requesterId: string,
    options?: DashboardBookingsOptions,
  ): Promise<ServiceBookingDashboardRow[]> {
    try {
      const query = this.db
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
      const rows = await (options?.limit !== undefined
        ? query.limit(options.limit)
        : query);

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
   * Bookings where the user is the provider, with listing title and requester
   * as counterparty, newest first. Unbounded unless `options.limit` is given
   * (see `findByRequesterForDashboard`).
   */
  async findByProviderForDashboard(
    providerId: string,
    options?: DashboardBookingsOptions,
  ): Promise<ServiceBookingDashboardRow[]> {
    try {
      const query = this.db
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
      const rows = await (options?.limit !== undefined
        ? query.limit(options.limit)
        : query);

      return rows.map((row) => ({
        ...row.booking,
        listingTitle: row.listingTitle,
        counterparty: row.counterparty,
      }));
    } catch (error) {
      this.handleError(error, "ServiceBookingDAL.findByProviderForDashboard");
    }
  }
}
