import { EMAIL_LOGO_HTML } from "@/features/notifications/utils/email-logo";
import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to renter when deposit hold fails
 */
export async function sendDepositHoldFailureNotificationToRenter({
  userId,
  to,
  renterName,
  listingName,
  rentalId,
  securityDeposit,
}: {
  userId: string;
  to: string;
  renterName: string;
  listingName: string;
  rentalId: string;
  securityDeposit: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}?view=renting`;

  return await sendNotification({
    userId,
    type: "payment_failed",
    title: "Security Deposit Hold Failed",
    message: `The security deposit hold for "${listingName}" could not be placed. Please update your payment method.`,
    data: {
      rentalId,
      listingName,
      securityDeposit,
    },
    linkUrl,
    category: "payments",
    email: {
      to,
      subject: `Security Deposit Hold Failed: ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Security Deposit Hold Failed</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${EMAIL_LOGO_HTML}

            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #92400e; margin-top: 0;">Security Deposit Hold Failed</h2>
            </div>

            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${renterName},
            </h1>

            <p style="font-size: 16px; margin-bottom: 20px;">
              Your rental payment for <strong>${listingName}</strong> was processed successfully, but we were unable to place the security deposit hold of <strong>$${securityDeposit}</strong> on your payment method.
            </p>

            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #92400e; margin-top: 0;">What this means</h3>
              <p style="margin: 0; color: #78350f;">
                Your rental is proceeding as scheduled, but deposit protection is not yet active. If your payment method is updated, the deposit hold will be retried automatically.
              </p>
            </div>

            <h3 style="color: #2563eb;">What to do next:</h3>
            <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Verify your payment method has sufficient funds for the $${securityDeposit} hold</li>
              <li>Update your payment method if needed</li>
              <li>You can also retry the deposit hold from your rental details page</li>
            </ol>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/dashboard/profile/payments"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Update Payment Method
              </a>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you have questions or need assistance, please contact our support team.
            </p>

            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${renterName},

Your rental payment for ${listingName} was processed successfully, but we were unable to place the security deposit hold of $${securityDeposit} on your payment method.

What this means:
Your rental is proceeding as scheduled, but deposit protection is not yet active. If your payment method is updated, the deposit hold will be retried automatically.

What to do next:
1. Verify your payment method has sufficient funds for the $${securityDeposit} hold
2. Update your payment method if needed
3. You can also retry the deposit hold from your rental details page

Update your payment method: ${baseUrl}/dashboard/profile/payments

If you have questions or need assistance, please contact our support team.

The Hoador Team
      `.trim(),
    },
  });
}

/**
 * Send notification to owner when deposit hold fails
 */
export async function sendDepositHoldFailureNotificationToOwner({
  userId,
  to,
  ownerName,
  renterName,
  listingName,
  rentalId,
  securityDeposit,
}: {
  userId: string;
  to: string;
  ownerName: string;
  renterName: string;
  listingName: string;
  rentalId: string;
  securityDeposit: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}?view=lending`;

  return await sendNotification({
    userId,
    type: "payment_failed",
    title: "Deposit Hold Not Placed",
    message: `The security deposit hold for "${listingName}" could not be placed. The rental is proceeding without deposit protection.`,
    data: {
      rentalId,
      listingName,
      renterName,
      securityDeposit,
    },
    linkUrl,
    category: "payments",
    email: {
      to,
      subject: `Deposit Hold Not Placed: ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Deposit Hold Not Placed</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${EMAIL_LOGO_HTML}

            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #92400e; margin-top: 0;">Deposit Hold Not Placed</h2>
            </div>

            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${ownerName},
            </h1>

            <p style="font-size: 16px; margin-bottom: 20px;">
              The rental payment from ${renterName} for <strong>${listingName}</strong> was processed successfully, but the security deposit hold of <strong>$${securityDeposit}</strong> could not be placed.
            </p>

            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #92400e; margin-top: 0;">What this means</h3>
              <p style="margin: 0; color: #78350f;">
                The rental is proceeding as scheduled, but without deposit protection. ${renterName} has been notified to update their payment method. The deposit hold will be retried automatically once updated.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/dashboard/rental/${rentalId}?view=lending"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Rental Details
              </a>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              No action is required from you at this time. We'll keep you updated on the deposit status.
            </p>

            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${ownerName},

The rental payment from ${renterName} for ${listingName} was processed successfully, but the security deposit hold of $${securityDeposit} could not be placed.

What this means:
The rental is proceeding as scheduled, but without deposit protection. ${renterName} has been notified to update their payment method. The deposit hold will be retried automatically once updated.

View Rental Details: ${baseUrl}/dashboard/rental/${rentalId}?view=lending

No action is required from you at this time. We'll keep you updated on the deposit status.

The Hoador Team
      `.trim(),
    },
  });
}
