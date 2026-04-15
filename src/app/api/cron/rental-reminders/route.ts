import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import { verifyCronSecret } from "@/lib/api/verify-cron-secret";
import { rentalDAL } from "@/dal";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { formatAlertText } from "@/features/rentals/lib/format-alert-text";
import { differenceInDays } from "@/lib/utils/date.utils";

/**
 * Daily cron: push reminders for approved rentals that start today or have a missed start.
 * Secured with CRON_SECRET (Authorization: Bearer).
 */
async function getHandler(request: NextRequest) {
  const auth = verifyCronSecret(request);
  if (!auth.authorized) return auth.response;

  const referenceDay = new Date();
  referenceDay.setHours(0, 0, 0, 0);

  const rows =
    await rentalDAL.getApprovedRentalsForDailyReminders(referenceDay);
  let sent = 0;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  for (const row of rows) {
    const daysLate = row.isMissedStart
      ? Math.max(0, differenceInDays(referenceDay, row.startDate))
      : 0;

    const ownerMessage = formatAlertText(
      "not_started",
      "owner",
      row.deliveryRequested,
      daysLate,
    );
    const renterMessage = formatAlertText(
      "not_started",
      "renter",
      row.deliveryRequested,
      daysLate,
    );

    const linkUrl = baseUrl
      ? `${baseUrl}/dashboard/rental/${row.rentalRequestId}`
      : `/dashboard/rental/${row.rentalRequestId}`;

    const recipients: Array<{ userId: string; message: string }> = [
      { userId: row.ownerId, message: ownerMessage },
      { userId: row.renterId, message: renterMessage },
    ];

    for (const { userId, message } of recipients) {
      try {
        const result = await sendNotification({
          userId,
          type: "rental_reminder",
          title: "Rental reminder",
          message,
          linkUrl,
        });
        if (result.success) sent += 1;
        else
          console.error(
            "[rental-reminders] sendNotification did not succeed",
            result.error,
          );
      } catch (err) {
        console.error("[rental-reminders] sendNotification failed", err);
      }
    }
  }

  return NextResponse.json({ sent });
}

export const GET = withRequestLogging(
  getHandler,
  "GET /api/cron/rental-reminders",
);
