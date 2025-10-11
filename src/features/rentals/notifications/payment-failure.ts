import { resend, RESEND_FROM_EMAIL } from "@/services/resend";

/**
 * Send email to renter when payment fails during rental approval
 */
export async function sendPaymentFailureEmailToRenter({
  to,
  renterName,
  ownerName,
  listingName,
  totalAmount,
  failureReason,
}: {
  to: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  totalAmount: string;
  failureReason: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: `Payment Failed for ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Failed</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://hoador-web.vercel.app/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <div style="background-color: #fee; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #dc2626; margin-top: 0;">⚠️ Payment Failed</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${renterName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${ownerName} approved your rental request for <strong>${listingName}</strong>, but we were unable to process your payment.
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Rental Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Owner:</strong> ${ownerName}</li>
                <li><strong>Total Amount:</strong> $${totalAmount}</li>
              </ul>
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #92400e; margin-top: 0;">Reason for Failure</h3>
              <p style="margin: 0; color: #78350f;">${failureReason}</p>
            </div>
            
            <h3 style="color: #2563eb;">What to do next:</h3>
            <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Update your payment method in your dashboard</li>
              <li>Ensure you have sufficient funds available</li>
              <li>Contact ${ownerName} to let them know you're ready</li>
              <li>${ownerName} can then retry the approval</li>
            </ol>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hoador-web.vercel.app/dashboard/profile" 
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

${ownerName} approved your rental request for ${listingName}, but we were unable to process your payment.

Rental Details:
- Listing: ${listingName}
- Owner: ${ownerName}
- Total Amount: $${totalAmount}

Reason for Failure:
${failureReason}

What to do next:
1. Update your payment method in your dashboard
2. Ensure you have sufficient funds available
3. Contact ${ownerName} to let them know you're ready
4. ${ownerName} can then retry the approval

Update your payment method: https://hoador-web.vercel.app/dashboard/profile

If you have questions or need assistance, please contact our support team.

The Hoador Team
      `.trim(),
    });

    if (error) {
      console.error("Failed to send payment failure email to renter:", error);
      throw new Error("Failed to send payment failure email to renter");
    }

    console.log("Payment failure email sent to renter:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending payment failure email to renter:", error);
    throw error;
  }
}

/**
 * Send email to owner when payment fails during rental approval
 */
export async function sendPaymentFailureEmailToOwner({
  to,
  ownerName,
  renterName,
  listingName,
  totalAmount,
  failureReason,
}: {
  to: string;
  ownerName: string;
  renterName: string;
  listingName: string;
  totalAmount: string;
  failureReason: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: `Payment Could Not Be Processed for ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Could Not Be Processed</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://hoador-web.vercel.app/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #92400e; margin-top: 0;">⚠️ Payment Could Not Be Processed</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${ownerName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              You approved the rental request from ${renterName} for <strong>${listingName}</strong>, but we were unable to process their payment.
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Rental Details</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Renter:</strong> ${renterName}</li>
                <li><strong>Total Amount:</strong> $${totalAmount}</li>
              </ul>
            </div>
            
            <div style="background-color: #fee; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #991b1b; margin-top: 0;">Reason for Failure</h3>
              <p style="margin: 0; color: #7f1d1d;">${failureReason}</p>
            </div>
            
            <h3 style="color: #2563eb;">What happens next:</h3>
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>${renterName} has been notified to update their payment method</li>
              <li>The rental request remains in <strong>pending status</strong></li>
              <li>Once ${renterName} updates their payment method, they will contact you</li>
              <li>You can then retry the approval to process the payment</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hoador-web.vercel.app/dashboard/lending/incoming" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Pending Requests
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              No action is required from you at this time. We'll keep you updated when ${renterName} is ready to proceed.
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${ownerName},

You approved the rental request from ${renterName} for ${listingName}, but we were unable to process their payment.

Rental Details:
- Listing: ${listingName}
- Renter: ${renterName}
- Total Amount: $${totalAmount}

Reason for Failure:
${failureReason}

What happens next:
- ${renterName} has been notified to update their payment method
- The rental request remains in pending status
- Once ${renterName} updates their payment method, they will contact you
- You can then retry the approval to process the payment

View Pending Requests: https://hoador-web.vercel.app/dashboard/lending/incoming

No action is required from you at this time. We'll keep you updated when ${renterName} is ready to proceed.

The Hoador Team
      `.trim(),
    });

    if (error) {
      console.error("Failed to send payment failure email to owner:", error);
      throw new Error("Failed to send payment failure email to owner");
    }

    console.log("Payment failure email sent to owner:", data?.id);
    return data;
  } catch (error) {
    console.error("Error sending payment failure email to owner:", error);
    throw error;
  }
}
