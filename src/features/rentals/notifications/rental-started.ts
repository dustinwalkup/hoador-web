import { resend, RESEND_FROM_EMAIL } from "@/services/resend";

/**
 * Send email to renter when owner starts the rental
 */
export async function sendRentalStartedEmail({
  to,
  renterName,
  ownerName,
  listingName,
  rentalId,
}: {
  to: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  rentalId: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: `Your Rental Has Started: ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rental Started</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://hoador-web.vercel.app/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #065f46; margin-top: 0;">🎉 Rental Started!</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${renterName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Great news! ${ownerName} has started your rental for <strong>${listingName}</strong>. The rental is now active!
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Rental Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Owner:</strong> ${ownerName}</li>
                <li><strong>Status:</strong> Active</li>
              </ul>
            </div>
            
            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #1e40af; margin-top: 0;">📋 Important Reminders</h3>
              <ul style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
                <li>Follow all pickup and return instructions provided</li>
                <li>Inspect the item carefully before and after use</li>
                <li>Contact ${ownerName} if you have any questions or issues</li>
                <li>Return the item on time and in the same condition</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hoador-web.vercel.app/dashboard/rental/${rentalId}?view=renting" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Rental Details
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Enjoy your rental and remember to handle the item with care. If you encounter any problems, please reach out to ${ownerName} immediately.
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${renterName},

Great news! ${ownerName} has started your rental for ${listingName}. The rental is now active!

Rental Details:
- Listing: ${listingName}
- Owner: ${ownerName}
- Status: Active

Important Reminders:
- Follow all pickup and return instructions provided
- Inspect the item carefully before and after use
- Contact ${ownerName} if you have any questions or issues
- Return the item on time and in the same condition

View Rental Details: https://hoador-web.vercel.app/dashboard/rental/${rentalId}?view=renting

Enjoy your rental and remember to handle the item with care. If you encounter any problems, please reach out to ${ownerName} immediately.

The Hoador Team
      `.trim(),
    });

    if (error) {
      console.error("Failed to send rental started email:", error);
      throw new Error("Failed to send rental started email");
    }

    console.log("Rental started email sent:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending rental started email:", error);
    throw error;
  }
}
