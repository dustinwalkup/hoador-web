import { getEmailLogoAttachment } from "@/features/notifications/utils/email-logo";
import { resend, RESEND_FROM_EMAIL } from "@/services/resend";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email using Resend API.
 * When HTML is present, attaches the Hoador logo as an inline image (CID) so it displays
 * without relying on external URLs. Handles errors gracefully - logs but doesn't throw.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const logoAttachment = getEmailLogoAttachment();
    const attachments = logoAttachment
      ? [
          {
            filename: logoAttachment.filename,
            content: logoAttachment.content,
            contentId: logoAttachment.contentId,
          },
        ]
      : undefined;

    const { data, error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
      text,
      ...(attachments && { attachments }),
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }

    console.log("Email sent successfully:", data?.id);
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
