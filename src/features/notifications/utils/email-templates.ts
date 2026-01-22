/**
 * Email templates for listing review notifications
 */

interface ListingApprovalEmailData {
  ownerName: string;
  listingName: string;
  garageUrl: string;
  baseUrl: string;
}

interface ListingRejectionEmailData {
  ownerName: string;
  listingName: string;
  rejectionReason: string;
  garageUrl: string;
  baseUrl: string;
}

/**
 * Generate HTML email template for listing approval notification
 */
export function generateListingApprovalEmailHtml({
  ownerName,
  listingName,
  garageUrl,
  baseUrl,
}: ListingApprovalEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Listing Approved</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${baseUrl}/hoador-logo.svg" alt="Hoador" style="height: 50px;">
        </div>
        
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
          <h2 style="color: #065f46; margin-top: 0;">✓ Listing Approved</h2>
        </div>
        
        <h1 style="color: #333; margin-bottom: 20px;">
          Hi ${ownerName},
        </h1>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          Great news! Your listing <strong>${listingName}</strong> has been approved and is now live on Hoador.
        </p>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #2563eb; margin-top: 0;">What's Next?</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Your listing is now visible to other users in your community</li>
            <li>You can manage your listing from the Garage page</li>
            <li>You'll receive notifications when someone requests to rent it</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${garageUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            View My Garage
          </a>
        </div>
        
        <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
          <p>Happy tool sharing!</p>
          <p>The Hoador Team</p>
        </div>
      </body>
    </html>
  `.trim();
}

/**
 * Generate plain text email template for listing approval notification
 */
export function generateListingApprovalEmailText({
  ownerName,
  listingName,
  garageUrl,
}: Omit<ListingApprovalEmailData, "baseUrl">): string {
  return `
Hi ${ownerName},

Great news! Your listing "${listingName}" has been approved and is now live on Hoador.

What's Next?
- Your listing is now visible to other users in your community
- You can manage your listing from the Garage page
- You'll receive notifications when someone requests to rent it

View My Garage: ${garageUrl}

Happy tool sharing!

The Hoador Team
  `.trim();
}

/**
 * Generate HTML email template for listing rejection notification
 */
export function generateListingRejectionEmailHtml({
  ownerName,
  listingName,
  rejectionReason,
  garageUrl,
  baseUrl,
}: ListingRejectionEmailData): string {
  // Escape HTML in rejection reason
  const escapedReason = rejectionReason
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Listing Needs Changes</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="${baseUrl}/hoador-logo.svg" alt="Hoador" style="height: 50px;">
        </div>
        
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
          <h2 style="color: #92400e; margin-top: 0;">Listing Needs Changes</h2>
        </div>
        
        <h1 style="color: #333; margin-bottom: 20px;">
          Hi ${ownerName},
        </h1>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          Your listing <strong>${listingName}</strong> requires some changes before it can be approved and published.
        </p>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #2563eb; margin-top: 0;">Feedback</h3>
          <p style="margin: 0; color: #64748b; white-space: pre-wrap;">${escapedReason}</p>
        </div>
        
        <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="color: #1e40af; margin-top: 0;">What's Next?</h3>
          <ol style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
            <li>Review the feedback above</li>
            <li>Edit your listing to address the concerns</li>
            <li>Save your changes - your listing will be resubmitted for review automatically</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${garageUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Edit Listing
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          Once you've made the necessary changes, your listing will be automatically resubmitted for review.
        </p>
        
        <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
          <p>The Hoador Team</p>
        </div>
      </body>
    </html>
  `.trim();
}

/**
 * Generate plain text email template for listing rejection notification
 */
export function generateListingRejectionEmailText({
  ownerName,
  listingName,
  rejectionReason,
  garageUrl,
}: Omit<ListingRejectionEmailData, "baseUrl">): string {
  return `
Hi ${ownerName},

Your listing "${listingName}" requires some changes before it can be approved and published.

Feedback:
${rejectionReason}

What's Next?
1. Review the feedback above
2. Edit your listing to address the concerns
3. Save your changes - your listing will be resubmitted for review automatically

Edit Listing: ${garageUrl}

Once you've made the necessary changes, your listing will be automatically resubmitted for review.

The Hoador Team
  `.trim();
}
