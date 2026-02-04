/**
 * Loads rental agreement payload from database.
 * Imports RentalDAL directly to avoid loading the full DAL index (and geocoding).
 */

import { RentalDAL } from "@/dal/rentals.dal";
import type { RentalAgreementData } from "./template";

const rentalDAL = new RentalDAL();

/**
 * Loads rental request + listing + user data and returns a RentalAgreementData payload.
 *
 * @param rentalRequestId - Rental request id.
 * @returns RentalAgreementData or null if request not found.
 */
export async function getPayloadForRentalAgreement(
  rentalRequestId: string,
): Promise<RentalAgreementData | null> {
  try {
    const details = await rentalDAL.getRentalDetailsById(rentalRequestId);

    const listingParts = [
      details.listingName,
      details.listingDescription,
      [details.listingBrand, details.listingModel].filter(Boolean).join(" "),
    ].filter(Boolean);
    const listingDescription = listingParts.join(" - ").trim() || "N/A";

    const startDate =
      details.startDate instanceof Date
        ? details.startDate.toLocaleDateString(undefined, {
            dateStyle: "medium",
          })
        : new Date(details.startDate).toLocaleDateString(undefined, {
            dateStyle: "medium",
          });
    const endDate =
      details.endDate instanceof Date
        ? details.endDate.toLocaleDateString(undefined, {
            dateStyle: "medium",
          })
        : new Date(details.endDate).toLocaleDateString(undefined, {
            dateStyle: "medium",
          });

    const rentalLocation =
      details.deliveryRequested && details.deliveryAddress
        ? details.deliveryAddress
        : (details.pickupAddress ?? "N/A");

    const totalRentalAmount = Number(details.totalAmount).toLocaleString(
      "en-US",
      {
        style: "currency",
        currency: "USD",
      },
    );

    return {
      providerName: details.ownerName,
      renterName: details.renterName,
      listingDescription,
      startDate,
      endDate,
      rentalLocation,
      totalRentalAmount,
    };
  } catch {
    return null;
  }
}
