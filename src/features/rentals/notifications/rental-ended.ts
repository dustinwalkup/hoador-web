import { resend, RESEND_FROM_EMAIL } from "@/services/resend";

/**
 * Send email to renter when owner ends the rental
 */
export async function sendRentalEndedEmail({
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
      subject: `Rental Completed: ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rental Completed</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://hoador-web.vercel.app/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #92400e; margin-top: 0;">✅ Rental Completed</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${renterName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your rental for <strong>${listingName}</strong> has been completed by ${ownerName}. Thank you for being a responsible renter!
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Rental Summary</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Owner:</strong> ${ownerName}</li>
                <li><strong>Status:</strong> Completed</li>
              </ul>
            </div>
            
            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #1e40af; margin-top: 0;">⭐ Leave a Review</h3>
              <p style="margin: 10px 0; color: #1e3a8a;">
                Help other renters by sharing your experience! Your feedback helps build trust in our community.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hoador-web.vercel.app/dashboard/rental/${rentalId}?view=renting" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; margin-bottom: 10px;">
                Write a Review
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              We hope you had a great rental experience! If you have any concerns, please contact ${ownerName} through the messaging system.
            </p>
            
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #166534;">
                <strong>💡 Pro Tip:</strong> Check out other available listings from ${ownerName} or explore more items to rent in your area!
              </p>
            </div>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${renterName},

Your rental for ${listingName} has been completed by ${ownerName}. Thank you for being a responsible renter!

Rental Summary:
- Listing: ${listingName}
- Owner: ${ownerName}
- Status: Completed

Leave a Review:
Help other renters by sharing your experience! Your feedback helps build trust in our community.

Write a Review: https://hoador-web.vercel.app/dashboard/rental/${rentalId}?view=renting

We hope you had a great rental experience! If you have any concerns, please contact ${ownerName} through the messaging system.

Pro Tip: Check out other available listings from ${ownerName} or explore more items to rent in your area!

The Hoador Team
      `.trim(),
    });

    if (error) {
      console.error("Failed to send rental ended email:", error);
      throw new Error("Failed to send rental ended email");
    }

    console.log("Rental ended email sent:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending rental ended email:", error);
    throw error;
  }
}
