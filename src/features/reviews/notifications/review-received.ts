import { EMAIL_LOGO_HTML } from "@/features/notifications/utils/email-logo";
import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to owner when they receive a new review
 */
export async function sendReviewReceivedNotification({
  userId,
  to,
  ownerName,
  reviewerName,
  listingName,
  rating,
  reviewTitle,
  reviewComment,
  listingId,
}: {
  userId: string;
  to: string;
  ownerName: string;
  reviewerName: string;
  listingName: string;
  rating: number;
  reviewTitle?: string;
  reviewComment?: string;
  listingId: string;
}) {
  const linkUrl = `https://hoador-web.vercel.app/dashboard/listings/${listingId}`;
  const stars = "⭐".repeat(rating);

  return await sendNotification({
    userId,
    type: "review_received",
    title: "New Review Received",
    message: `${reviewerName} left a ${rating}-star review for ${listingName}`,
    data: {
      listingId,
      listingName,
      reviewerName,
      rating,
      reviewTitle: reviewTitle || null,
    },
    linkUrl,
    email: {
      to,
      subject: `New Review for ${listingName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Review</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${EMAIL_LOGO_HTML}
            
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #92400e; margin-top: 0;">⭐ New Review Received</h2>
            </div>
            
            <h1 style="color: #333; margin-bottom: 20px;">
              Hi ${ownerName},
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Great news! ${reviewerName} left a review for your <strong>${listingName}</strong>.
            </p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Review Details</h3>
              <div style="margin: 15px 0;">
                <div style="font-size: 24px; margin-bottom: 10px;">${stars}</div>
                <div style="color: #64748b; margin-bottom: 5px;"><strong>Rating:</strong> ${rating} out of 5</div>
                <div style="color: #64748b;"><strong>Reviewer:</strong> ${reviewerName}</div>
              </div>
              
              ${
                reviewTitle
                  ? `
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 10px 0; color: #1e293b;">${reviewTitle}</h4>
              </div>
              `
                  : ""
              }
              
              ${
                reviewComment
                  ? `
              <div style="margin-top: ${reviewTitle ? "10" : "20"}px; ${reviewTitle ? "" : "padding-top: 20px; border-top: 1px solid #e2e8f0;"}">
                <p style="margin: 0; color: #475569; font-style: italic;">"${reviewComment}"</p>
              </div>
              `
                  : ""
              }
            </div>
            
            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #065f46; margin-top: 0;">💡 Build Your Reputation</h3>
              <p style="margin: 0; color: #047857;">
                Reviews help other renters discover your listings and build trust in the community. Keep up the great work!
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hoador-web.vercel.app/dashboard/listings/${listingId}" 
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Full Review
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Thank you for being a valued member of the Hoador community!
            </p>
            
            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${ownerName},

Great news! ${reviewerName} left a review for your ${listingName}.

Review Details:
- Rating: ${stars} (${rating} out of 5)
- Reviewer: ${reviewerName}
${reviewTitle ? `- Title: ${reviewTitle}` : ""}
${reviewComment ? `- Comment: "${reviewComment}"` : ""}

Build Your Reputation:
Reviews help other renters discover your listings and build trust in the community. Keep up the great work!

View Full Review: https://hoador-web.vercel.app/dashboard/listings/${listingId}

Thank you for being a valued member of the Hoador community!

The Hoador Team
      `.trim(),
    },
  });
}
