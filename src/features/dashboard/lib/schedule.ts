/**
 * Dashboard schedule helper: builds upcoming events (return due, pickup due) for the next 7 days.
 * @see specs/dashboard/2-design.md getUpcomingSchedule
 */

import type {
  ScheduleEntry,
  ScheduleEntryRole,
} from "@/features/dashboard/types";
import {
  getBorrowedListingsCached,
  getLendingRequestsByStatusCached,
  findServiceBookingsByRequesterCached,
  findServiceBookingsByProviderCached,
} from "./cached-fetchers";

type MaybePromise<T> = T | Promise<T>;

/**
 * Sources `getUpcomingSchedule` would otherwise fetch itself. A caller that
 * already holds them (the dashboard summary route, which shares them with
 * pulse and the activity feed) passes them in, as values or in-flight
 * promises, so each is queried once per request. `cache()` can't dedupe
 * outside an RSC render, so a route handler must share them explicitly.
 */
export interface UpcomingScheduleSources {
  borrowed: MaybePromise<Awaited<ReturnType<typeof getBorrowedListingsCached>>>;
  lendingApproved: MaybePromise<
    Awaited<ReturnType<typeof getLendingRequestsByStatusCached>>
  >;
  lendingActive: MaybePromise<
    Awaited<ReturnType<typeof getLendingRequestsByStatusCached>>
  >;
  asClient: MaybePromise<
    Awaited<ReturnType<typeof findServiceBookingsByRequesterCached>>
  >;
  asProvider: MaybePromise<
    Awaited<ReturnType<typeof findServiceBookingsByProviderCached>>
  >;
}

/**
 * Natural-language rental line for the current user role and delivery mode.
 */
function buildRentalLabel(
  eventType: "pickup" | "return",
  role: "renter" | "owner",
  counterpartyName: string,
  deliveryRequested: boolean,
): string {
  if (role === "renter") {
    if (eventType === "pickup") {
      return deliveryRequested
        ? `Delivery from ${counterpartyName}`
        : `Pickup from ${counterpartyName}`;
    }
    return deliveryRequested
      ? `Pickup by ${counterpartyName}`
      : `Return to ${counterpartyName}`;
  }
  if (eventType === "pickup") {
    return deliveryRequested
      ? `Deliver to ${counterpartyName}`
      : `Pickup by ${counterpartyName}`;
  }
  return deliveryRequested
    ? `Pickup from ${counterpartyName}`
    : `Return from ${counterpartyName}`;
}

/**
 * Full name from service booking counterparty; the counterparty's role word if
 * both are missing. Takes the VIEWER's role and names the other side — the
 * client's counterparty is the provider and vice versa — so a nameless
 * counterparty reads "Service with provider" / "Service for client", matching
 * the rental fallback below (TERMINOLOGY-GUIDELINES §3.2).
 */
function formatServiceCounterpartyName(
  firstName: string | null,
  lastName: string | null,
  viewerRole: "client" | "provider",
): string {
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return viewerRole === "client" ? "provider" : "client";
}

function normalizeRentalCounterpartyName(
  name: string,
  fallback: "owner" | "renter",
): string {
  const t = name.trim();
  return t.length > 0 ? t : fallback;
}

/**
 * Returns schedule entries for the next 7 days: return due and pickup due events
 * from borrowed listings (as renter) and approved/active lending (as owner),
 * plus accepted service bookings (as client or provider).
 *
 * @param userId - Current user id
 * @param prefetched - Sources the caller already fetched; omitted, they're fetched here
 * @returns ScheduleEntry[] sorted by date
 */
export async function getUpcomingSchedule(
  userId: string,
  prefetched?: UpcomingScheduleSources,
): Promise<ScheduleEntry[]> {
  const [borrowed, lendingApproved, lendingActive, asClient, asProvider] =
    await Promise.all(
      prefetched
        ? [
            prefetched.borrowed,
            prefetched.lendingApproved,
            prefetched.lendingActive,
            prefetched.asClient,
            prefetched.asProvider,
          ]
        : [
            getBorrowedListingsCached(userId),
            getLendingRequestsByStatusCached("approved", userId),
            getLendingRequestsByStatusCached("active", userId),
            findServiceBookingsByRequesterCached(userId),
            findServiceBookingsByProviderCached(userId),
          ],
    );

  // Use calendar-day bounds so dates at midnight (e.g. same-day returns) are included.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endWindow = new Date(today);
  endWindow.setDate(endWindow.getDate() + 7);
  endWindow.setHours(23, 59, 59, 999); // Inclusive of full last day

  const entries: ScheduleEntry[] = [];

  /** Normalize to start of calendar day for consistent window comparison. */
  const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const addReturn = (
    date: Date,
    listingName: string,
    id: string,
    view: "renting" | "lending",
    counterpartyName: string,
    deliveryRequested: boolean,
    setupRequested?: boolean,
  ) => {
    const role: ScheduleEntryRole = view === "renting" ? "renter" : "owner";
    const d = startOfDay(date);
    if (d >= today && d <= endWindow) {
      const cp = normalizeRentalCounterpartyName(
        counterpartyName,
        view === "renting" ? "owner" : "renter",
      );
      const description = buildRentalLabel(
        "return",
        role,
        cp,
        deliveryRequested,
      );
      entries.push({
        id: `rental-${id}-return-${role}`,
        date: d,
        description,
        subtitle: listingName,
        linkTo: `/dashboard/rental/${id}?view=${view}`,
        type: "return",
        role,
        deliveryRequested,
        setupRequested,
      });
    }
  };

  const addPickup = (
    date: Date,
    listingName: string,
    id: string,
    view: "renting" | "lending",
    counterpartyName: string,
    deliveryRequested: boolean,
    setupRequested?: boolean,
  ) => {
    const role: ScheduleEntryRole = view === "renting" ? "renter" : "owner";
    const d = startOfDay(date);
    if (d >= today && d <= endWindow) {
      const cp = normalizeRentalCounterpartyName(
        counterpartyName,
        view === "renting" ? "owner" : "renter",
      );
      const description = buildRentalLabel(
        "pickup",
        role,
        cp,
        deliveryRequested,
      );
      entries.push({
        id: `rental-${id}-pickup-${role}`,
        date: d,
        description,
        subtitle: listingName,
        linkTo: `/dashboard/rental/${id}?view=${view}`,
        type: "pickup",
        role,
        deliveryRequested,
        setupRequested,
      });
    }
  };

  /** True when pickup and return fall on the same calendar day. */
  const isSameDay = (a: Date, b: Date) =>
    startOfDay(a).getTime() === startOfDay(b).getTime();

  for (const r of [...borrowed.currentRentals, ...borrowed.upcomingRentals]) {
    const sameDay = isSameDay(r.startDate, r.endDate);
    if (sameDay) {
      // Same-day rental: show only the relevant event based on status to avoid
      // showing both pickup and return on the same calendar row.
      if (r.status === "approved") {
        addPickup(
          r.startDate,
          r.listingName,
          r.id,
          "renting",
          r.ownerName,
          r.deliveryRequested,
          r.setupRequested,
        );
      } else if (r.status === "active") {
        addReturn(
          r.endDate,
          r.listingName,
          r.id,
          "renting",
          r.ownerName,
          r.deliveryRequested,
          r.setupRequested,
        );
      }
    } else {
      addPickup(
        r.startDate,
        r.listingName,
        r.id,
        "renting",
        r.ownerName,
        r.deliveryRequested,
        r.setupRequested,
      );
      addReturn(
        r.endDate,
        r.listingName,
        r.id,
        "renting",
        r.ownerName,
        r.deliveryRequested,
        r.setupRequested,
      );
    }
  }

  for (const r of lendingApproved) {
    const sameDay = isSameDay(r.startDate, r.endDate);
    addPickup(
      r.startDate,
      r.listingName,
      r.id,
      "lending",
      r.renterName,
      r.deliveryRequested,
      r.setupRequested,
    );
    if (!sameDay) {
      // For same-day approved owner rentals, suppress return until rental goes active.
      addReturn(
        r.endDate,
        r.listingName,
        r.id,
        "lending",
        r.renterName,
        r.deliveryRequested,
        r.setupRequested,
      );
    }
  }
  for (const r of lendingActive) {
    addReturn(
      r.endDate,
      r.listingName,
      r.id,
      "lending",
      r.renterName,
      r.deliveryRequested,
      r.setupRequested,
    );
  }

  const normalizeProposedDate = (raw: unknown): string => {
    if (raw instanceof Date) {
      return raw.toISOString().slice(0, 10);
    }
    return String(raw).slice(0, 10);
  };

  const addServiceEntry = (
    proposedDateRaw: unknown,
    listingTitle: string,
    bookingId: string,
    role: "client" | "provider",
    counterpartyName: string,
  ) => {
    const proposedDate = normalizeProposedDate(proposedDateRaw);
    const d = new Date(`${proposedDate}T00:00:00`);
    d.setHours(0, 0, 0, 0);
    if (d >= today && d <= endWindow) {
      const description =
        role === "client"
          ? `Service with ${counterpartyName}`
          : `Service for ${counterpartyName}`;
      entries.push({
        id: `service-${bookingId}`,
        date: d,
        description,
        subtitle: listingTitle,
        linkTo: `/dashboard/services/bookings/${bookingId}`,
        type: "service",
        role,
      });
    }
  };

  for (const b of asClient.filter((b) => b.status === "accepted")) {
    const name = formatServiceCounterpartyName(
      b.counterparty.firstName,
      b.counterparty.lastName,
      "client",
    );
    addServiceEntry(b.proposedDate, b.listingTitle, b.id, "client", name);
  }
  for (const b of asProvider.filter((b) => b.status === "accepted")) {
    const name = formatServiceCounterpartyName(
      b.counterparty.firstName,
      b.counterparty.lastName,
      "provider",
    );
    addServiceEntry(b.proposedDate, b.listingTitle, b.id, "provider", name);
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  return entries;
}
