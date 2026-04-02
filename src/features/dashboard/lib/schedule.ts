/**
 * Dashboard schedule helper: builds upcoming events (return due, pickup due) for the next 7 days.
 * @see specs/dashboard/2-design.md getUpcomingSchedule
 */

import { rentalDAL, serviceBookingDAL } from "@/dal";
import type {
  ScheduleEntry,
  ScheduleEntryRole,
} from "@/features/dashboard/types";

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
 * Full name from service booking counterparty; role word if both missing.
 */
function formatServiceCounterpartyName(
  firstName: string | null,
  lastName: string | null,
  roleFallback: "client" | "provider",
): string {
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return roleFallback;
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
 * @returns ScheduleEntry[] sorted by date
 */
export async function getUpcomingSchedule(
  userId: string,
): Promise<ScheduleEntry[]> {
  const [borrowed, lendingApproved, lendingActive, asClient, asProvider] =
    await Promise.all([
      rentalDAL.getBorrowedListings(userId),
      rentalDAL.getLendingRequestsByStatus("approved", userId),
      rentalDAL.getLendingRequestsByStatus("active", userId),
      serviceBookingDAL.findByRequesterForDashboard(userId),
      serviceBookingDAL.findByProviderForDashboard(userId),
    ]);

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
      });
    }
  };

  for (const r of borrowed.currentRentals) {
    addPickup(
      r.startDate,
      r.listingName,
      r.id,
      "renting",
      r.ownerName,
      r.deliveryRequested,
    );
    addReturn(
      r.endDate,
      r.listingName,
      r.id,
      "renting",
      r.ownerName,
      r.deliveryRequested,
    );
  }
  for (const r of borrowed.upcomingRentals) {
    addPickup(
      r.startDate,
      r.listingName,
      r.id,
      "renting",
      r.ownerName,
      r.deliveryRequested,
    );
    addReturn(
      r.endDate,
      r.listingName,
      r.id,
      "renting",
      r.ownerName,
      r.deliveryRequested,
    );
  }

  for (const r of lendingApproved) {
    addPickup(
      r.startDate,
      r.listingName,
      r.id,
      "lending",
      r.renterName,
      r.deliveryRequested,
    );
    addReturn(
      r.endDate,
      r.listingName,
      r.id,
      "lending",
      r.renterName,
      r.deliveryRequested,
    );
  }
  for (const r of lendingActive) {
    addReturn(
      r.endDate,
      r.listingName,
      r.id,
      "lending",
      r.renterName,
      r.deliveryRequested,
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
