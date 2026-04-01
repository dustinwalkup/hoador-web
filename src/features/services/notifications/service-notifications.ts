import { EMAIL_LOGO_HTML } from "@/features/notifications/utils/email-logo";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { serviceListingDAL, userDAL } from "@/dal";
import { formatPPP } from "@/lib/utils/date.utils";
import type {
  ServiceBooking,
  ServiceListing,
} from "@/db/schemas/services.schema";
import type { ServiceNoShowReport } from "@/db/schemas/service-no-show-reports.schema";

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Formats `proposedDate` (ISO `YYYY-MM-DD`) for notification copy using long US style
 * (e.g. April 15, 2026). Uses a noon local anchor to avoid UTC day-shift.
 */
function formatBookingDate(booking: ServiceBooking): string {
  const d = booking.proposedDate;
  const raw = typeof d === "string" ? d : String(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  return formatPPP(`${raw}T12:00:00`);
}

async function listingTitleForBooking(listingId: string): Promise<string> {
  const detail = await serviceListingDAL.getById(listingId);
  return detail?.title ?? "Service listing";
}

async function recipientForUserId(userId: string): Promise<{
  email: string;
  displayName: string;
} | null> {
  const u = await userDAL.getUserById(userId);
  if (!u?.email) {
    return null;
  }
  const displayName =
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.name;
  return { email: u.email, displayName };
}

function compactEmailHtml(opts: {
  heading: string;
  greeting: string;
  bodyLines: string[];
  cta?: { label: string; href: string };
}): string {
  const cta = opts.cta
    ? `<div style="text-align: center; margin: 28px 0;"><a href="${opts.cta.href}" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">${opts.cta.label}</a></div>`
    : "";
  const lines = opts.bodyLines
    .map(
      (line) => `<p style="font-size: 16px; margin-bottom: 14px;">${line}</p>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
${EMAIL_LOGO_HTML}
<div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 14px; margin-bottom: 22px; border-radius: 4px;">
  <h2 style="color: #1e40af; margin-top: 0;">${opts.heading}</h2>
</div>
<h1 style="color: #333; margin-bottom: 12px; font-size: 22px;">${opts.greeting}</h1>
${lines}
${cta}
<p style="font-size: 12px; color: #94a3b8; margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 16px;">The Hoador Team</p>
</body>
</html>`;
}

/**
 * Notify provider that a resident submitted a new service booking request.
 */
export async function sendNewBookingRequestNotification(
  providerId: string,
  booking: ServiceBooking,
): Promise<ReturnType<typeof sendNotification>> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/dashboard/services/bookings/${booking.id}`;
  const listingName = await listingTitleForBooking(booking.listingId);
  const recipient = await recipientForUserId(providerId);
  if (!recipient) {
    return { success: false, error: "Provider not found" };
  }

  const when = formatBookingDate(booking);

  return await sendNotification({
    userId: providerId,
    type: "service_booking_requested",
    title: "New service booking request",
    message: `Someone requested "${listingName}" for ${when}.`,
    data: {
      bookingId: booking.id,
      listingId: booking.listingId,
      proposedDate: when,
      proposedTime: booking.proposedTime,
      totalAmount: String(booking.totalAmount),
    },
    linkUrl,
    email: {
      to: recipient.email,
      subject: `New booking request: ${listingName}`,
      html: compactEmailHtml({
        heading: "New booking request",
        greeting: `Hi ${escapeHtml(recipient.displayName)},`,
        bodyLines: [
          `You have a new booking request for <strong>${escapeHtml(listingName)}</strong>.`,
          `Proposed date: <strong>${escapeHtml(when)}</strong> at <strong>${escapeHtml(booking.proposedTime)}</strong>.`,
          `Total (estimate): <strong>$${escapeHtml(String(booking.totalAmount))}</strong>.`,
        ],
        cta: { label: "Review booking", href: linkUrl },
      }),
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `You have a new booking request for ${listingName}.`,
        `Proposed: ${when} at ${booking.proposedTime}.`,
        `Total: $${booking.totalAmount}.`,
        "",
        linkUrl,
      ].join("\n"),
    },
  });
}

/**
 * Notify requester that the provider accepted and payment succeeded.
 */
export async function sendBookingAcceptedNotification(
  requesterId: string,
  booking: ServiceBooking,
): Promise<ReturnType<typeof sendNotification>> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/dashboard/services/bookings/${booking.id}`;
  const listingName = await listingTitleForBooking(booking.listingId);
  const recipient = await recipientForUserId(requesterId);
  if (!recipient) {
    return { success: false, error: "Requester not found" };
  }

  const when = formatBookingDate(booking);

  return await sendNotification({
    userId: requesterId,
    type: "service_booking_accepted",
    title: "Booking accepted",
    message: `Your booking for "${listingName}" on ${when} was accepted and payment was processed.`,
    data: {
      bookingId: booking.id,
      listingId: booking.listingId,
      proposedDate: when,
      totalAmount: String(booking.totalAmount),
    },
    linkUrl,
    email: {
      to: recipient.email,
      subject: `Booking accepted: ${listingName}`,
      html: compactEmailHtml({
        heading: "Booking accepted",
        greeting: `Hi ${escapeHtml(recipient.displayName)},`,
        bodyLines: [
          `Your booking for <strong>${escapeHtml(listingName)}</strong> was <strong>accepted</strong>.`,
          `We successfully processed your payment for <strong>$${escapeHtml(String(booking.totalAmount))}</strong>.`,
          `Scheduled for: <strong>${escapeHtml(when)}</strong> at <strong>${escapeHtml(booking.proposedTime)}</strong>.`,
        ],
        cta: { label: "View booking", href: linkUrl },
      }),
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `Your booking for ${listingName} was accepted.`,
        `Payment processed: $${booking.totalAmount}.`,
        `Scheduled for: ${when} at ${booking.proposedTime}.`,
        "",
        linkUrl,
      ].join("\n"),
    },
  });
}

/**
 * Notify requester that the provider declined the booking.
 */
export async function sendBookingDeclinedNotification(
  requesterId: string,
  booking: ServiceBooking,
  reason: string,
): Promise<ReturnType<typeof sendNotification>> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/dashboard/services/bookings/${booking.id}`;
  const listingName = await listingTitleForBooking(booking.listingId);
  const recipient = await recipientForUserId(requesterId);
  if (!recipient) {
    return { success: false, error: "Requester not found" };
  }

  const safeReason = escapeHtml(reason);

  return await sendNotification({
    userId: requesterId,
    type: "service_booking_declined",
    title: "Booking declined",
    message: `Your booking request for "${listingName}" was declined.`,
    data: {
      bookingId: booking.id,
      listingId: booking.listingId,
      declineReason: reason,
    },
    linkUrl,
    email: {
      to: recipient.email,
      subject: `Booking declined: ${listingName}`,
      html: compactEmailHtml({
        heading: "Booking declined",
        greeting: `Hi ${escapeHtml(recipient.displayName)},`,
        bodyLines: [
          `The provider declined your request for <strong>${escapeHtml(listingName)}</strong>.`,
          `<strong>Reason:</strong> ${safeReason}`,
        ],
        cta: { label: "View booking", href: linkUrl },
      }),
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `Your booking for ${listingName} was declined.`,
        `Reason: ${reason}`,
        "",
        linkUrl,
      ].join("\n"),
    },
  });
}

/**
 * Notify requester that the provider marked the job complete.
 */
export async function sendJobCompletedNotification(
  requesterId: string,
  booking: ServiceBooking,
): Promise<ReturnType<typeof sendNotification>> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/dashboard/services/bookings/${booking.id}`;
  const listingName = await listingTitleForBooking(booking.listingId);
  const recipient = await recipientForUserId(requesterId);
  if (!recipient) {
    return { success: false, error: "Requester not found" };
  }

  return await sendNotification({
    userId: requesterId,
    type: "service_booking_completed",
    title: "Service marked complete",
    message: `"${listingName}" was marked complete. Thanks for using HOA Services.`,
    data: {
      bookingId: booking.id,
      listingId: booking.listingId,
    },
    linkUrl,
    email: {
      to: recipient.email,
      subject: `Service complete: ${listingName}`,
      html: compactEmailHtml({
        heading: "Job complete",
        greeting: `Hi ${escapeHtml(recipient.displayName)},`,
        bodyLines: [
          `The provider marked your booking for <strong>${escapeHtml(listingName)}</strong> as <strong>complete</strong>.`,
          `You can leave a review from the booking page.`,
        ],
        cta: { label: "Open booking", href: linkUrl },
      }),
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `Your service for ${listingName} was marked complete.`,
        "",
        linkUrl,
      ].join("\n"),
    },
  });
}

/**
 * Notify provider that payout was sent to their Connect account.
 */
export async function sendServicePayoutNotification(
  providerId: string,
  booking: ServiceBooking,
): Promise<ReturnType<typeof sendNotification>> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/dashboard/services/bookings/${booking.id}`;
  const listingName = await listingTitleForBooking(booking.listingId);
  const recipient = await recipientForUserId(providerId);
  if (!recipient) {
    return { success: false, error: "Provider not found" };
  }

  return await sendNotification({
    userId: providerId,
    type: "service_payout_sent",
    title: "Payout sent",
    message: `Payout for "${listingName}" was sent to your connected account.`,
    data: {
      bookingId: booking.id,
      listingId: booking.listingId,
      servicePrice: String(booking.servicePrice),
    },
    linkUrl,
    email: {
      to: recipient.email,
      subject: `Payout sent: ${listingName}`,
      html: compactEmailHtml({
        heading: "Payout sent",
        greeting: `Hi ${escapeHtml(recipient.displayName)},`,
        bodyLines: [
          `We sent your payout for <strong>${escapeHtml(listingName)}</strong> to your Stripe connected account.`,
          `Booking: <strong>${escapeHtml(booking.id)}</strong>.`,
        ],
        cta: { label: "View booking", href: linkUrl },
      }),
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `Payout sent for ${listingName} (booking ${booking.id}).`,
        "",
        linkUrl,
      ].join("\n"),
    },
  });
}

/**
 * Notify provider that their listing was approved.
 */
export async function sendListingApprovedNotification(
  providerId: string,
  listing: ServiceListing,
): Promise<ReturnType<typeof sendNotification>> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/dashboard/services/listings/${listing.id}`;
  const recipient = await recipientForUserId(providerId);
  if (!recipient) {
    return { success: false, error: "Provider not found" };
  }

  return await sendNotification({
    userId: providerId,
    type: "service_listing_approved",
    title: "Listing approved",
    message: `"${listing.title}" is now live in your community.`,
    data: {
      listingId: listing.id,
      title: listing.title,
    },
    linkUrl,
    email: {
      to: recipient.email,
      subject: `Approved: ${listing.title}`,
      html: compactEmailHtml({
        heading: "Listing approved",
        greeting: `Hi ${escapeHtml(recipient.displayName)},`,
        bodyLines: [
          `Your service listing <strong>${escapeHtml(listing.title)}</strong> was approved and is visible to residents.`,
        ],
        cta: { label: "View listing", href: linkUrl },
      }),
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `Your listing "${listing.title}" was approved.`,
        "",
        linkUrl,
      ].join("\n"),
    },
  });
}

/**
 * Notify provider that their listing was not approved (admin denial).
 */
export async function sendListingRejectedNotification(
  providerId: string,
  listing: ServiceListing,
  reason: string,
): Promise<ReturnType<typeof sendNotification>> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/dashboard/services/listings/${listing.id}`;
  const recipient = await recipientForUserId(providerId);
  if (!recipient) {
    return { success: false, error: "Provider not found" };
  }

  const safeReason = escapeHtml(reason);

  return await sendNotification({
    userId: providerId,
    type: "service_listing_rejected",
    title: "Listing not approved",
    message: `"${listing.title}" was not approved. Reason: ${reason}`,
    data: {
      listingId: listing.id,
      title: listing.title,
      rejectionReason: reason,
    },
    linkUrl,
    email: {
      to: recipient.email,
      subject: `Listing update: ${listing.title}`,
      html: compactEmailHtml({
        heading: "Listing not approved",
        greeting: `Hi ${escapeHtml(recipient.displayName)},`,
        bodyLines: [
          `Your listing <strong>${escapeHtml(listing.title)}</strong> was not approved.`,
          `<strong>Reason:</strong> ${safeReason}`,
        ],
        cta: { label: "View listing", href: linkUrl },
      }),
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `Your listing "${listing.title}" was not approved.`,
        `Reason: ${reason}`,
        "",
        linkUrl,
      ].join("\n"),
    },
  });
}

/**
 * Notify all active admin/superadmin users that a listing needs review.
 */
export async function sendListingPendingAdminNotification(
  listing: ServiceListing,
): Promise<void> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/admin/dashboard/services/listings/review`;
  const staff = await userDAL.getStaffNotificationRecipients();
  const provider = await recipientForUserId(listing.providerId);
  const providerLabel = provider?.displayName ?? "A provider";

  await Promise.all(
    staff.map((admin) =>
      sendNotification({
        userId: admin.id,
        type: "service_listing_pending",
        title: "Service listing pending review",
        message: `${providerLabel} submitted "${listing.title}" for approval.`,
        data: {
          listingId: listing.id,
          providerId: listing.providerId,
          title: listing.title,
        },
        linkUrl,
        email: {
          to: admin.email,
          subject: `Review service listing: ${listing.title}`,
          html: compactEmailHtml({
            heading: "Listing pending review",
            greeting: `Hi ${escapeHtml([admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() || "there")},`,
            bodyLines: [
              `<strong>${escapeHtml(providerLabel)}</strong> submitted <strong>${escapeHtml(listing.title)}</strong> for approval.`,
            ],
            cta: { label: "Open review queue", href: linkUrl },
          }),
          text: [
            `A new service listing is pending review: ${listing.title}`,
            "",
            linkUrl,
          ].join("\n"),
        },
      }),
    ),
  );
}

/**
 * Notify staff that a no-show was reported on a booking.
 */
export async function sendNoShowReportAdminNotification(
  report: ServiceNoShowReport,
  booking: ServiceBooking,
): Promise<void> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/dashboard/services/bookings/${booking.id}`;
  const staff = await userDAL.getStaffNotificationRecipients();
  const listingName = await listingTitleForBooking(booking.listingId);
  const notes = report.notes?.trim() ? escapeHtml(report.notes.trim()) : "—";
  const when = formatBookingDate(booking);

  await Promise.all(
    staff.map((admin) =>
      sendNotification({
        userId: admin.id,
        type: "service_no_show_reported",
        title: "No-show reported",
        message: `No-show reported for "${listingName}" (booking ${booking.id}). Scheduled: ${when} at ${booking.proposedTime}.`,
        data: {
          reportId: report.id,
          bookingId: booking.id,
          listingId: booking.listingId,
        },
        linkUrl,
        email: {
          to: admin.email,
          subject: `No-show report: ${listingName}`,
          html: compactEmailHtml({
            heading: "No-show report",
            greeting: `Hi ${escapeHtml([admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() || "there")},`,
            bodyLines: [
              `A no-show was reported for booking <strong>${escapeHtml(booking.id)}</strong> (${escapeHtml(listingName)}).`,
              `Scheduled: <strong>${escapeHtml(when)}</strong> at <strong>${escapeHtml(booking.proposedTime)}</strong>.`,
              `<strong>Notes:</strong> ${notes}`,
            ],
            cta: { label: "View booking", href: linkUrl },
          }),
          text: [
            `No-show reported for ${listingName}.`,
            `Booking: ${booking.id}.`,
            `Scheduled: ${when} at ${booking.proposedTime}.`,
            report.notes ? `Notes: ${report.notes}` : "",
            "",
            linkUrl,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      }),
    ),
  );
}
