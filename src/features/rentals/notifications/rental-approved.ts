import { EMAIL_LOGO_HTML } from "@/features/notifications/utils/email-logo";
import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to renter when owner approves their rental request
 */
export async function sendRentalApprovedNotification({
  userId,
  to,
  renterName,
  ownerName,
  listingName,
  rentalId,
  startDate,
  endDate,
  totalAmount,
  firstApproval,
}: {
  userId: string;
  to: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  rentalId: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
  firstApproval?: boolean;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const params = new URLSearchParams({ view: "renting" });
  if (firstApproval) params.set("firstApproval", "1");
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}?${params.toString()}`;

  return await sendNotification({
    userId,
    type: "rental_approved",
    title: "Rental Request Approved!",
    message: `${ownerName} approved your rental request for ${listingName}`,
    data: {
      rentalId,
      listingName,
      ownerName,
      startDate,
      endDate,
      totalAmount,
    },
    linkUrl,
    email: {
      to,
      subject: `Your Rental Request Was Approved: ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rental Approved</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${EMAIL_LOGO_HTML}
            
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #065f46; margin-top: 0;">✅ Rental Request Approved!</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${renterName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Great news! ${ownerName} has approved your rental request for <strong>${listingName}</strong>. Your payment has been processed successfully.
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Rental Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Owner:</strong> ${ownerName}</li>
                <li><strong>Start Date:</strong> ${startDate}</li>
                <li><strong>End Date:</strong> ${endDate}</li>
                <li><strong>Total Amount:</strong> $${totalAmount}</li>
                <li><strong>Status:</strong> Approved - Awaiting Start</li>
              </ul>
            </div>
            
            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
              <ol style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
                <li>Wait for ${ownerName} to start the rental on ${startDate}</li>
                <li>Review the pickup and return instructions</li>
                <li>Contact ${ownerName} if you have any questions</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${linkUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Rental Details
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              You'll receive another notification when ${ownerName} starts the rental on ${startDate}.
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${renterName},

Great news! ${ownerName} has approved your rental request for ${listingName}. Your payment has been processed successfully.

Rental Details:
- Listing: ${listingName}
- Owner: ${ownerName}
- Start Date: ${startDate}
- End Date: ${endDate}
- Total Amount: $${totalAmount}
- Status: Approved - Awaiting Start

Next Steps:
1. Wait for ${ownerName} to start the rental on ${startDate}
2. Review the pickup and return instructions
3. Contact ${ownerName} if you have any questions

View Rental Details: ${linkUrl}

You'll receive another notification when ${ownerName} starts the rental on ${startDate}.

The Hoador Team
      `.trim(),
    },
  });
}
