export type AlertType =
  | "overdue_return"
  | "not_started"
  | "end_today"
  | "service_not_completed";

export type AlertUserRole = "owner" | "renter" | "provider" | "client";

function daysPhrase(n: number): string {
  return n === 1 ? "1 day" : `${n} days`;
}

/**
 * Returns a plain-language alert string for a given alert type, user role,
 * delivery mode, and optional days-late count.
 *
 * Pure function with no side effects — fully unit testable.
 * Copy matches the UX Phase 1 design doc alert table.
 *
 * @param alertType   - The category of alert
 * @param userRole    - The current user's role in the booking
 * @param deliveryRequested - Whether delivery was part of the rental (ignored for service alerts)
 * @param daysLate    - How many days past the relevant date (for overdue and not_started / service)
 */
export function formatAlertText(
  alertType: AlertType,
  userRole: AlertUserRole,
  deliveryRequested: boolean,
  daysLate?: number,
): string {
  const days = daysLate ?? 0;
  const d = daysPhrase(days);

  switch (alertType) {
    case "overdue_return": {
      const n = Math.max(days, 1);
      const label = daysPhrase(n);
      if (userRole === "renter") {
        return deliveryRequested
          ? `Your return is ${label} overdue — contact the owner to arrange collection`
          : `Your return is ${label} overdue — return the item to the owner`;
      }
      // Names the mobile control, "Confirm return" (see `end_today` below).
      return deliveryRequested
        ? `Return is ${label} overdue — tap Confirm return once you collect the item`
        : `Return is ${label} overdue — tap Confirm return once the item is back`;
    }

    case "not_started": {
      if (days > 0) {
        return userRole === "owner"
          ? `This rental should have started ${d} ago`
          : `Your rental was due to start ${d} ago`;
      }
      // Names the mobile control, "Start rental". Also the owner's push body
      // (cron/rental-reminders), which reuses this function.
      if (userRole === "owner") {
        return deliveryRequested
          ? "Rental starts today — tap Start rental when you deliver the item"
          : "Rental starts today — tap Start rental when the renter picks up the item";
      }
      if (userRole === "renter") {
        return deliveryRequested
          ? "Your rental starts today — the owner will deliver the item to you"
          : "Your rental starts today — coordinate pickup with the owner";
      }
      return "Rental starts today.";
    }

    case "end_today": {
      // Names the mobile app's control, "Confirm return" (mobile shows this
      // text verbatim; TERMINOLOGY-GUIDELINES §4.1). The route and the web
      // dialog keep their "end rental" names — this is copy only.
      if (userRole === "owner") {
        return deliveryRequested
          ? "Rental ends today — tap Confirm return when you pick up the item"
          : "Rental ends today — tap Confirm return when the item is returned";
      }
      if (userRole === "renter") {
        return deliveryRequested
          ? "Your rental ends today — the owner will come to collect the item"
          : "Your rental ends today — return the item to the owner";
      }
      return "This rental ends today.";
    }

    case "service_not_completed": {
      if (days === 0) {
        return userRole === "client"
          ? "Your service was today — contact your provider if there's an issue"
          : "Service was today — mark it complete when finished";
      }
      return userRole === "client"
        ? `Your service from ${d} ago hasn't been completed`
        : `Service from ${d} ago hasn't been marked complete`;
    }

    default:
      return "Action required for this rental.";
  }
}
