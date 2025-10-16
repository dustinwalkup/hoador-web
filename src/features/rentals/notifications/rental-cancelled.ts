import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification when a rental is cancelled (in-app only)
 */
export async function sendRentalCancelledNotification({
  recipientUserId,
  recipientName,
  otherPartyName,
  listingName,
  rentalId,
  cancelledBy,
  cancellationReason,
}: {
  recipientUserId: string;
  recipientName: string;
  otherPartyName: string;
  listingName: string;
  rentalId: string;
  cancelledBy: "owner" | "renter";
  cancellationReason?: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}`;

  return await sendNotification({
    userId: recipientUserId,
    type: "rental_cancelled",
    title: "Rental Cancelled",
    message: `${otherPartyName} cancelled the rental for ${listingName}`,
    data: {
      rentalId,
      listingName,
      recipientName,
      otherPartyName,
      cancelledBy,
      cancellationReason: cancellationReason || null,
    },
    linkUrl,
  });
}
