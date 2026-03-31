/**
 * Loads service agreement payload from the database.
 * Uses ServiceBookingDAL directly to avoid unnecessary coupling.
 */

import { ServiceBookingDAL } from "@/dal/service-booking.dal";

import type { ServiceAgreementData } from "./template";

const serviceBookingDAL = new ServiceBookingDAL();

function formatName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const parts = [first?.trim(), last?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "N/A";
}

/**
 * Loads booking + listing + users and returns ServiceAgreementData.
 *
 * @param serviceBookingId - Service booking id.
 * @returns ServiceAgreementData or null if booking not found.
 */
export async function getPayloadForServiceAgreement(
  serviceBookingId: string,
): Promise<ServiceAgreementData | null> {
  try {
    const detail = await serviceBookingDAL.getById(serviceBookingId);
    if (!detail) {
      return null;
    }

    const listingParts = [
      detail.listing.title,
      detail.listing.description?.slice(0, 500),
    ].filter(Boolean);
    const serviceDescription = listingParts.join(" — ").trim() || "N/A";

    const dateStr =
      typeof detail.proposedDate === "string"
        ? detail.proposedDate
        : String(detail.proposedDate);
    const timePart = detail.proposedTime?.slice(0, 5) ?? detail.proposedTime;
    const scheduledIso = `${dateStr}T${timePart}:00`;
    const scheduled = new Date(scheduledIso);
    const scheduledDateTime = Number.isNaN(scheduled.getTime())
      ? `${dateStr} ${detail.proposedTime}`
      : scheduled.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });

    let durationOrScope = "Fixed price service";
    if (detail.hours != null && String(detail.hours).trim() !== "") {
      const h = Number(detail.hours);
      if (Number.isFinite(h)) {
        durationOrScope = `${h} hour${h !== 1 ? "s" : ""} (estimated)`;
      }
    }

    const totalAmount = Number(detail.totalAmount).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });

    return {
      providerName: formatName(
        detail.provider.firstName,
        detail.provider.lastName,
      ),
      requesterName: formatName(
        detail.requester.firstName,
        detail.requester.lastName,
      ),
      serviceDescription,
      scheduledDateTime,
      durationOrScope,
      totalAmount,
    };
  } catch {
    return null;
  }
}
