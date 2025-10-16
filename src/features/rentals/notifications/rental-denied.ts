import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to renter when owner denies their rental request
 */
export async function sendRentalDeniedNotification({
  userId,
  to,
  renterName,
  ownerName,
  listingName,
  rentalId,
  denialReason,
}: {
  userId: string;
  to: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  rentalId: string;
  denialReason?: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/explore`;

  return await sendNotification({
    userId,
    type: "rental_denied",
    title: "Rental Request Declined",
    message: `${ownerName} declined your rental request for ${listingName}`,
    data: {
      rentalId,
      listingName,
      ownerName,
      denialReason: denialReason || null,
    },
    linkUrl,
    email: {
      to,
      subject: `Rental Request Declined: ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rental Request Declined</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${baseUrl}/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #92400e; margin-top: 0;">Rental Request Declined</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${renterName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Unfortunately, ${ownerName} has declined your rental request for <strong>${listingName}</strong>.
            </p>
            
            ${
              denialReason
                ? `
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Reason for Decline</h3>
              <p style="margin: 0; color: #64748b;">${denialReason}</p>
            </div>
            `
                : ""
            }
            
            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #1e40af; margin-top: 0;">What's Next?</h3>
              <p style="margin: 10px 0; color: #1e3a8a;">
                Don't worry! There are plenty of other great tools available to rent in your community.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/dashboard/explore" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Browse Other Tools
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Keep exploring and you'll find the perfect tool for your project!
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${renterName},

Unfortunately, ${ownerName} has declined your rental request for ${listingName}.

${denialReason ? `Reason for Decline:\n${denialReason}\n` : ""}

What's Next?
Don't worry! There are plenty of other great tools available to rent in your community.

Browse Other Tools: ${baseUrl}/dashboard/explore

Keep exploring and you'll find the perfect tool for your project!

The Hoador Team
      `.trim(),
    },
  });
}
