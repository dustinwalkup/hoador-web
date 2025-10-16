import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to renter when owner updates pickup/return instructions (in-app only)
 */
export async function sendInstructionsUpdatedNotification({
  userId,
  renterName,
  ownerName,
  listingName,
  rentalId,
  pickupInstructions,
  returnInstructions,
}: {
  userId: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  rentalId: string;
  pickupInstructions?: string;
  returnInstructions?: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}?view=renting`;

  return await sendNotification({
    userId,
    type: "system",
    title: "Instructions Updated",
    message: `${ownerName} has updated the instructions for your rental of ${listingName}.`,
    data: {
      rentalId,
      listingName,
      ownerName,
      renterName,
      pickupInstructions: pickupInstructions || null,
      returnInstructions: returnInstructions || null,
    },
    linkUrl,
  });
}
