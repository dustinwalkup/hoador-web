import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification when a rental, or a rental request, is cancelled (in-app only).
 *
 * `stage` says which one it was: a pending request is not yet a rental
 * (TERMINOLOGY-GUIDELINES §3.1), so its cancellation names the request.
 */
export async function sendRentalCancelledNotification({
  recipientUserId,
  recipientName,
  otherPartyName,
  listingName,
  rentalId,
  cancelledBy,
  cancellationReason,
  stage,
}: {
  recipientUserId: string;
  recipientName: string;
  otherPartyName: string;
  listingName: string;
  rentalId: string;
  cancelledBy: "owner" | "renter";
  cancellationReason?: string;
  /** `"request"` while it was still pending; `"rental"` once accepted. */
  stage: "request" | "rental";
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}`;

  return await sendNotification({
    userId: recipientUserId,
    type: "rental_cancelled",
    title:
      stage === "request" ? "Rental Request Cancelled" : "Rental Cancelled",
    message:
      stage === "request"
        ? `${otherPartyName} cancelled their rental request for ${listingName}`
        : `${otherPartyName} cancelled the rental for ${listingName}`,
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
