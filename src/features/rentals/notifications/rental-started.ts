import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to renter when owner starts the rental (in-app only)
 */
export async function sendRentalStartedNotification({
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
    type: "rental_started",
    title: "Your Rental Has Started",
    message: `${ownerName} has started your rental for ${listingName}. The rental is now active!`,
    data: {
      rentalId,
      listingName,
      ownerName,
      renterName,
    },
    linkUrl,
  });
}
