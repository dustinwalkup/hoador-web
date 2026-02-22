/**
 * Dashboard schedule helper: builds upcoming events (return due, pickup due) for the next 7 days.
 * @see specs/dashboard/2-design.md getUpcomingSchedule
 */

import { rentalDAL } from "@/dal";
import type { ScheduleEntry } from "@/features/dashboard/types";

/**
 * Returns schedule entries for the next 7 days: return due and pickup due events
 * from borrowed listings (as renter) and approved/active lending (as owner).
 *
 * @param userId - Current user id
 * @returns ScheduleEntry[] sorted by date
 */
export async function getUpcomingSchedule(
  userId: string,
): Promise<ScheduleEntry[]> {
  const [borrowed, lendingApproved, lendingActive] = await Promise.all([
    rentalDAL.getBorrowedListings(userId),
    rentalDAL.getLendingRequestsByStatus("approved", userId),
    rentalDAL.getLendingRequestsByStatus("active", userId),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endWindow = new Date(today);
  endWindow.setDate(endWindow.getDate() + 7);

  const entries: ScheduleEntry[] = [];

  const addReturn = (
    date: Date,
    listingName: string,
    id: string,
    view: "renting" | "lending",
  ) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d >= today && d <= endWindow) {
      entries.push({
        date: d,
        description: `Return: ${listingName}`,
        linkTo: `/dashboard/rental/${id}?view=${view}`,
        type: "return",
      });
    }
  };

  const addPickup = (
    date: Date,
    listingName: string,
    id: string,
    view: "renting" | "lending",
  ) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d >= today && d <= endWindow) {
      entries.push({
        date: d,
        description: `Pickup: ${listingName}`,
        linkTo: `/dashboard/rental/${id}?view=${view}`,
        type: "pickup",
      });
    }
  };

  for (const r of borrowed.currentRentals) {
    addReturn(r.endDate, r.listingName, r.id, "renting");
  }
  for (const r of borrowed.upcomingRentals) {
    addPickup(r.startDate, r.listingName, r.id, "renting");
    addReturn(r.endDate, r.listingName, r.id, "renting");
  }

  for (const r of lendingApproved) {
    addPickup(r.startDate, r.listingName, r.id, "lending");
    addReturn(r.endDate, r.listingName, r.id, "lending");
  }
  for (const r of lendingActive) {
    addReturn(r.endDate, r.listingName, r.id, "lending");
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  return entries;
}
