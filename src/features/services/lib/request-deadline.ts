import { serviceInstant } from "./booking-cancellation";

/**
 * When a pending service booking request stops being answerable: the 72-hour
 * expiry, or the scheduled start (`serviceInstant`, the Central wall clock) if
 * that comes first, because accept is refused once the start has passed
 * (BIZ-10). On its own the 72 hours told a client booking two hours out that
 * the provider had "2d 23h to respond", and let a request outlive its own job
 * (Flow 6). Set at creation and applied again on every read, so a row created
 * before this rule reads (and expires) the same way.
 *
 * An unreadable schedule is unknown, not "now": the 72 hours stand, as accept
 * lets such a booking through.
 */
export function serviceRequestDeadline(
  expiresAt: Date,
  booking: { proposedDate: string | Date; proposedTime: string },
): Date {
  const startsAt = serviceInstant(booking);
  return startsAt && startsAt < expiresAt ? startsAt : expiresAt;
}
