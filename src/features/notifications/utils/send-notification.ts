import { tryCatch } from "@walkup/walkup-utils";
import { notificationsDAL } from "@/dal";
import { sendEmail } from "./send-email";
import type { notifications } from "@/db/schemas/notifications.schema";

interface SendNotificationOptions {
  userId: string;
  type: (typeof notifications.type.enumValues)[number];
  title: string;
  message: string;
  data?: Record<string, string | number | boolean | string[] | null>;
  linkUrl?: string;
  email?: {
    to: string;
    subject: string;
    html: string;
    text: string;
  };
  sms?: {
    to: string;
    body: string;
  }; // TODO: Implement SMS with Twilio
}

/**
 * Send a notification to a user
 * Creates an in-app notification and optionally sends email/SMS
 */
export async function sendNotification({
  userId,
  type,
  title,
  message,
  data = {},
  linkUrl,
  email,
  sms,
}: SendNotificationOptions): Promise<{
  success: boolean;
  notificationId?: string;
  error?: string;
  emailSent?: boolean;
  smsSent?: boolean;
}> {
  // Add linkUrl to notification data if provided
  const notificationData = linkUrl ? { ...data, linkUrl } : data;

  // Create in-app notification
  const { data: notification, error: notificationError } = await tryCatch(
    notificationsDAL.create({
      userId,
      type,
      title,
      message,
      data: notificationData,
    }),
  );

  if (notificationError || !notification) {
    console.error("Failed to create notification:", notificationError);
    return {
      success: false,
      error:
        notificationError?.message || "Failed to create in-app notification",
    };
  }

  let emailSent = false;
  let smsSent = false;

  // Send email if provided
  if (email) {
    const emailResult = await sendEmail(email);
    emailSent = emailResult.success;

    if (!emailResult.success) {
      console.error(
        "Email failed but notification was created:",
        emailResult.error,
      );
    }
  }

  // TODO: Send SMS if provided (Twilio integration)
  if (sms) {
    console.log(
      "SMS sending not yet implemented. Message would be sent to:",
      sms.to,
    );
    // Future: Implement Twilio SMS sending here
    smsSent = false;
  }

  return {
    success: true,
    notificationId: notification.id,
    emailSent,
    smsSent,
  };
}
