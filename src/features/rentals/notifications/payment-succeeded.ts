import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to renter when payment succeeds
 */
export async function sendPaymentSucceededNotificationToRenter({
  userId,
  to,
  renterName,
  ownerName,
  listingName,
  rentalId,
  totalAmount,
  securityDeposit,
}: {
  userId: string;
  to: string;
  renterName: string;
  ownerName: string;
  listingName: string;
  rentalId: string;
  totalAmount: string;
  securityDeposit: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}?view=renting`;

  return await sendNotification({
    userId,
    type: "payment_succeeded",
    title: "Payment Successful",
    message: `Your payment for ${listingName} has been processed successfully`,
    data: {
      rentalId,
      listingName,
      totalAmount,
      securityDeposit,
    },
    linkUrl,
    email: {
      to,
      subject: `Payment Confirmed: ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Confirmed</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${baseUrl}/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #065f46; margin-top: 0;">✅ Payment Confirmed</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${renterName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your payment for <strong>${listingName}</strong> has been processed successfully!
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Payment Summary</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Owner:</strong> ${ownerName}</li>
                <li><strong>Rental Amount:</strong> $${totalAmount}</li>
                <li><strong>Security Deposit:</strong> $${securityDeposit}</li>
              </ul>
            </div>
            
            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #1e40af; margin-top: 0;">About Your Security Deposit</h3>
              <p style="margin: 0; color: #1e3a8a;">
                The security deposit of $${securityDeposit} has been authorized on your payment method. It will only be charged if there is damage to the item. Otherwise, it will be released when the rental is completed.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/dashboard/rental/${rentalId}?view=renting" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Rental Details
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              You'll receive an email receipt shortly. If you have any questions, please contact our support team.
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${renterName},

Your payment for ${listingName} has been processed successfully!

Payment Summary:
- Listing: ${listingName}
- Owner: ${ownerName}
- Rental Amount: $${totalAmount}
- Security Deposit: $${securityDeposit}

About Your Security Deposit:
The security deposit of $${securityDeposit} has been authorized on your payment method. It will only be charged if there is damage to the item. Otherwise, it will be released when the rental is completed.

View Rental Details: ${baseUrl}/dashboard/rental/${rentalId}?view=renting

You'll receive an email receipt shortly. If you have any questions, please contact our support team.

The Hoador Team
      `.trim(),
    },
  });
}

/**
 * Send notification to owner when payment succeeds
 */
export async function sendPaymentSucceededNotificationToOwner({
  userId,
  to,
  ownerName,
  renterName,
  listingName,
  rentalId,
  totalAmount,
}: {
  userId: string;
  to: string;
  ownerName: string;
  renterName: string;
  listingName: string;
  rentalId: string;
  totalAmount: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/rental/${rentalId}?view=lending`;

  return await sendNotification({
    userId,
    type: "payment_succeeded",
    title: "Payment Received",
    message: `Payment received for ${listingName} rental to ${renterName}`,
    data: {
      rentalId,
      listingName,
      renterName,
      totalAmount,
    },
    linkUrl,
    email: {
      to,
      subject: `Payment Received: ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Received</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${baseUrl}/hoador-logo.svg" alt="Hoador" style="height: 50px;">
            </div>
            
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #065f46; margin-top: 0;">💰 Payment Received</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${ownerName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Payment for your <strong>${listingName}</strong> rental to ${renterName} has been processed successfully!
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Payment Summary</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Listing:</strong> ${listingName}</li>
                <li><strong>Renter:</strong> ${renterName}</li>
                <li><strong>Amount:</strong> $${totalAmount}</li>
              </ul>
            </div>
            
            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #1e40af; margin-top: 0;">Next Steps</h3>
              <p style="margin: 0; color: #1e3a8a;">
                Your payout will be processed within 2-3 business days after the rental is completed. Make sure your payment method is up to date in your profile.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/dashboard/rental/${rentalId}?view=lending" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Rental Details
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Thank you for sharing your tools with the community!
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${ownerName},

Payment for your ${listingName} rental to ${renterName} has been processed successfully!

Payment Summary:
- Listing: ${listingName}
- Renter: ${renterName}
- Amount: $${totalAmount}

Next Steps:
Your payout will be processed within 2-3 business days after the rental is completed. Make sure your payment method is up to date in your profile.

View Rental Details: ${baseUrl}/dashboard/rental/${rentalId}?view=lending

Thank you for sharing your tools with the community!

The Hoador Team
      `.trim(),
    },
  });
}
