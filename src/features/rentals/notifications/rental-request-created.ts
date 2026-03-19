import { EMAIL_LOGO_HTML } from "@/features/notifications/utils/email-logo";
import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to owner when a new rental request is created
 */
export async function sendRentalRequestCreatedNotification({
  userId,
  to,
  ownerName,
  renterName,
  listingName,
  rentalId,
  startDate,
  endDate,
  totalAmount,
}: {
  userId: string;
  to: string;
  ownerName: string;
  renterName: string;
  listingName: string;
  rentalId: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}?view=lending`;

  return await sendNotification({
    userId,
    type: "rental_request_created",
    title: "New Rental Request",
    message: `${renterName} wants to rent your ${listingName}`,
    data: {
      rentalId,
      listingName,
      renterName,
      startDate,
      endDate,
      totalAmount,
    },
    linkUrl,
    email: {
      to,
      subject: `New Rental Request for ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Rental Request</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${EMAIL_LOGO_HTML}
            
            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #1e40af; margin-top: 0;">🎉 New Rental Request</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${ownerName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Great news! ${renterName} wants to rent your <strong>${listingName}</strong>.
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Request Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Renter:</strong> ${renterName}</li>
                <li><strong>Start Date:</strong> ${startDate}</li>
                <li><strong>End Date:</strong> ${endDate}</li>
                <li><strong>Total Amount:</strong> $${totalAmount}</li>
              </ul>
            </div>
            
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #065f46; margin-top: 0;">Next Steps</h3>
              <ol style="margin: 10px 0; padding-left: 20px; color: #047857;">
                <li>Review the rental request details</li>
                <li>Check ${renterName}'s profile and ratings</li>
                <li>Approve or decline the request</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/dashboard/rentals/incoming/requests" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Review Request
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Please respond to this request as soon as possible to help ${renterName} plan their rental.
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${ownerName},

Great news! ${renterName} wants to rent your ${listingName}.

Request Details:
- Listing: ${listingName}
- Renter: ${renterName}
- Start Date: ${startDate}
- End Date: ${endDate}
- Total Amount: $${totalAmount}

Next Steps:
1. Review the rental request details
2. Check ${renterName}'s profile and ratings
3. Approve or decline the request

Review Request: ${baseUrl}/dashboard/rentals/incoming/requests

Please respond to this request as soon as possible to help ${renterName} plan their rental.

The Hoador Team
      `.trim(),
    },
  });
}
