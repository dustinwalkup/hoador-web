import { sendNotification } from "@/features/notifications/utils/send-notification";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
}

/**
 * Send "You received a review" notification to a reviewee when reviews are released.
 * Does NOT include comment text — user must view in-app.
 */
export async function sendReviewReleasedNotification(params: {
  revieweeId: string;
  revieweeName: string;
  reviewerName: string;
  rating: number;
  bookingType: "rental" | "service";
  bookingId: string;
}): Promise<void> {
  const { revieweeId, reviewerName, rating, bookingType, bookingId } = params;

  const linkUrl =
    bookingType === "rental"
      ? `${getBaseUrl()}/dashboard/rentals/${bookingId}`
      : `${getBaseUrl()}/dashboard/services/bookings/${bookingId}`;

  const stars = "\u2B50".repeat(rating);

  await sendNotification({
    userId: revieweeId,
    type: "review_received",
    title: "You Received a Review",
    message: `${reviewerName} left you a ${rating}-star review ${stars}`,
    data: {
      bookingType,
      bookingId,
      reviewerName,
      rating,
    },
    linkUrl,
  });
}
