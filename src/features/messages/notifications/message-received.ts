import { EMAIL_LOGO_HTML } from "@/features/notifications/utils/email-logo";
import { sendNotification } from "@/features/notifications/utils/send-notification";

/**
 * Send notification to recipient when they receive a new message.
 * Creates in-app notification, and sends email/push per user preferences.
 * Requirements: 8.1 (new message event)
 */
export async function sendMessageReceivedNotification({
  userId,
  to,
  senderName,
  conversationId,
}: {
  /** Recipient user ID (the user who received the message). */
  userId: string;
  /** Recipient email address for email notification. */
  to: string;
  /** Sender's display name (e.g. "John Doe"). */
  senderName: string;
  /** Conversation ID for the link and push payload. */
  conversationId: string;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://hoador-web.vercel.app";
  const linkUrl = `${baseUrl}/dashboard/mailbox?conversation=${conversationId}`;

  return await sendNotification({
    userId,
    type: "message_received",
    title: "New message",
    message: `${senderName} sent you a message`,
    data: { conversationId },
    linkUrl,
    category: "messages",
    email: {
      to,
      subject: `${senderName} sent you a message`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Message</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${EMAIL_LOGO_HTML}

            <div style="background-color: #e0f2fe; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 30px; border-radius: 4px;">
              <h2 style="color: #1e40af; margin-top: 0;">💬 New Message</h2>
            </div>

            <h1 style="color: #333; margin-bottom: 20px;">
              Hi,
            </h1>

            <p style="font-size: 16px; margin-bottom: 20px;">
              ${senderName} sent you a message. View the conversation to reply.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${linkUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                View Message
              </a>
            </div>

            <div style="border-top: 1px solid #eee; margin-top: 40px; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
              <p>The Hoador Team</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi,

${senderName} sent you a message. View the conversation to reply.

View Message: ${linkUrl}

The Hoador Team
      `.trim(),
    },
  });
}
