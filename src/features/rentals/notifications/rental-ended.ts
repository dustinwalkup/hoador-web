import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to renter when owner ends the rental (in-app only)
 */
export async function sendRentalEndedNotification({
  userId,
  renterName,
  ownerName,
  listingName,
  rentalId,
}: {
  userId: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  rentalId: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}?view=renting`;

  return await sendNotification({
    userId,
    type: "rental_ended",
    title: "Rental Completed",
    message: `Your rental for ${listingName} has been completed by ${ownerName}. Please leave a review!`,
    data: {
      rentalId,
      listingName,
      ownerName,
      renterName,
      promptReview: true,
    },
    linkUrl,
  });
}
