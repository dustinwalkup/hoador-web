import { EMAIL_LOGO_HTML } from "@/features/notifications/utils/email-logo";
import { sendNotification } from "@/features/notifications/utils/send-notification";
import { listingDAL, userDAL } from "@/dal";

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
 * Notify all active admin/superadmin users that a new review was submitted.
 */
export async function sendReviewSubmittedAdminNotification(review: {
  id: string;
  listingId?: string | null;
  rating: number;
}): Promise<void> {
  const baseUrl = appBaseUrl();
  const linkUrl = `${baseUrl}/admin/dashboard`;
  const staff = await userDAL.getStaffNotificationRecipients();

  let listingName = "a listing";
  if (review.listingId) {
    try {
      const listing = await listingDAL.getListingById(review.listingId);
      if (listing?.name) listingName = listing.name;
    } catch {
      // non-critical — fall back to generic label
    }
  }

  await Promise.all(
    staff.map((admin) =>
      sendNotification({
        userId: admin.id,
        type: "review_submitted",
        title: "New review submitted",
        message: `A ${review.rating}-star review was submitted for ${listingName}.`,
        data: {
          reviewId: review.id,
          listingId: review.listingId ?? null,
          rating: review.rating,
        },
        linkUrl,
        email: {
          to: admin.email,
          subject: `New ${review.rating}-star review submitted`,
          html: compactEmailHtml({
            heading: "New review submitted",
            greeting: `Hi ${escapeHtml([admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() || "there")},`,
            bodyLines: [
              `A <strong>${review.rating}-star</strong> review was submitted for <strong>${escapeHtml(listingName)}</strong>.`,
            ],
            cta: { label: "View admin dashboard", href: linkUrl },
          }),
          text: [
            `A ${review.rating}-star review was submitted for ${listingName}.`,
            "",
            linkUrl,
          ].join("\n"),
        },
      }).catch((err) =>
        console.error(
          `Failed to send review submitted admin notification for ${admin.id}:`,
          err,
        ),
      ),
    ),
  );
}
