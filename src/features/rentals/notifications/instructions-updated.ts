import { resend, RESEND_FROM_EMAIL } from "@/services/resend";

/**
 * Send email to renter when owner updates pickup/return instructions
 */
export async function sendInstructionsUpdatedEmail({
  to,
  renterName,
  ownerName,
  listingName,
  rentalId,
  pickupInstructions,
  returnInstructions,
}: {
  to: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  rentalId: string;
  pickupInstructions?: string;
  returnInstructions?: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: `Updated Instructions for ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Updated Instructions</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://hoador-web.vercel.app/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #1e40af; margin-top: 0;">📝 Instructions Updated</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${renterName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${ownerName} has updated the instructions for your rental of <strong>${listingName}</strong>.
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Rental Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Owner:</strong> ${ownerName}</li>
              </ul>
            </div>
            
            ${
              pickupInstructions
                ? `
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #065f46; margin-top: 0;">🚗 Pickup Instructions</h3>
              <p style="margin: 0; color: #047857; white-space: pre-wrap;">${pickupInstructions}</p>
            </div>
            `
                : ""
            }
            
            ${
              returnInstructions
                ? `
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #92400e; margin-top: 0;">🔄 Return Instructions</h3>
              <p style="margin: 0; color: #78350f; white-space: pre-wrap;">${returnInstructions}</p>
            </div>
            `
                : ""
            }
            
            <p style="font-size: 16px; margin-top: 30px;">
              Please review these updated instructions carefully to ensure a smooth rental experience.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hoador-web.vercel.app/dashboard/rental/${rentalId}?view=renting" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Rental Details
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you have any questions about these instructions, please contact ${ownerName} through the messaging system.
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${renterName},

${ownerName} has updated the instructions for your rental of ${listingName}.

Rental Details:
- Listing: ${listingName}
- Owner: ${ownerName}

${pickupInstructions ? `Pickup Instructions:\n${pickupInstructions}\n` : ""}
${returnInstructions ? `Return Instructions:\n${returnInstructions}\n` : ""}

Please review these updated instructions carefully to ensure a smooth rental experience.

View Rental Details: https://hoador-web.vercel.app/dashboard/rental/${rentalId}?view=renting

If you have any questions about these instructions, please contact ${ownerName} through the messaging system.

The Hoador Team
      `.trim(),
    });

    if (error) {
      console.error("Failed to send instructions updated email:", error);
      throw new Error("Failed to send instructions updated email");
    }

    console.log("Instructions updated email sent:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending instructions updated email:", error);
    throw error;
  }
}
