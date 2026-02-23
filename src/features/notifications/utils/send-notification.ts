import { tryCatch } from "@walkup/walkup-utils";
import { notificationsDAL } from "@/dal";
import { sendEmail } from "./send-email";
import type { notifications } from "@/db/schemas/notifications.schema";
import {
  NOTIFICATION_TYPE_TO_CATEGORY,
  type NotificationCategory,
} from "../lib/notification-type-map";
import { shouldSendEmail, shouldSendPush } from "../lib/preference-service";
import { buildPushPayload } from "../lib/push-payload";
import { sendPush } from "../lib/push-service";

type NotificationType = (typeof notifications.type.enumValues)[number];

interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, string | number | boolean | string[] | null>;
  linkUrl?: string;
  /** Preference category; inferred from type via notification-type-map if omitted. */
  category?: NotificationCategory;
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
  /** When false, skip sending email (e.g. admin "push only"). Default true. */
  sendEmail?: boolean;
  /** When false, skip sending push (e.g. admin "email only"). Default true. */
  sendPush?: boolean;
}

/**
 * Send a notification to a user.
 * Creates an in-app notification first, then sends email/push per user preferences.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8
 */
export async function sendNotification({
  userId,
  type,
  title,
  message,
  data = {},
  linkUrl,
  category: categoryParam,
  email,
  sms,
  sendEmail: sendEmailOption = true,
  sendPush: sendPushOption = true,
}: SendNotificationOptions): Promise<{
  success: boolean;
  notificationId?: string;
  error?: string;
  emailSent?: boolean;
  smsSent?: boolean;
}> {
  const category =
    categoryParam ?? NOTIFICATION_TYPE_TO_CATEGORY[type as NotificationType];
  const notificationData = linkUrl ? { ...data, linkUrl } : data;

  // Create in-app notification first (always)
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

  // Send email only if user preference allows, email payload provided, and not disabled
  if (email && sendEmailOption) {
    const allowEmail = await shouldSendEmail(userId, category);
    if (allowEmail) {
      const emailResult = await sendEmail(email);
      emailSent = emailResult.success;
      if (!emailResult.success) {
        console.error(
          "Email failed but notification was created:",
          emailResult.error,
        );
      }
    }
  }

  // Push: fire-and-forget after in-app notification is created (unless disabled)
  if (sendPushOption) {
    shouldSendPush(userId, category).then((allowPush) => {
      if (allowPush) {
        const payload = buildPushPayload(
          title,
          message,
          linkUrl ?? "/dashboard",
          type as NotificationType,
          data,
        );
        sendPush(userId, payload).catch((err) => {
          console.error("[sendNotification] push send failed:", err);
        });
      }
    });
  }

  // TODO: Send SMS if provided (Twilio integration)
  if (sms) {
    console.log(
      "SMS sending not yet implemented. Message would be sent to:",
      sms.to,
    );
    smsSent = false;
  }

  return {
    success: true,
    notificationId: notification.id,
    emailSent,
    smsSent,
  };
}
