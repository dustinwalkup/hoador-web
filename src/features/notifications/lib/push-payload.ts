import type { NotificationType } from "./notification-type-map";

/**
 * Push payload shape: reference IDs only, no PII or financial data.
 * Requirements: 7.1, 7.2, 7.3
 */
export interface PushPayload {
  title: string;
  body: string;
  linkUrl: string;
  data: {
    type: NotificationType;
    rentalId?: string;
    conversationId?: string;
    disputeId?: string;
  };
}

/**
 * Builds a push payload with only reference IDs in data.
 * Strips any PII or financial fields from the optional data object.
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @param linkUrl - URL to open on click (e.g. /dashboard/rentals/abc123)
 * @param type - Notification type for analytics and routing
 * @param data - Optional object; only rentalId, conversationId, disputeId are included
 * @returns PushPayload safe to send via Web Push
 */
export function buildPushPayload(
  title: string,
  body: string,
  linkUrl: string,
  type: NotificationType,
  data?: Record<string, string | number | boolean | string[] | null>,
): PushPayload {
  const safeData: PushPayload["data"] = { type };

  if (data && typeof data === "object") {
    if (typeof data.rentalId === "string") safeData.rentalId = data.rentalId;
    if (typeof data.conversationId === "string")
      safeData.conversationId = data.conversationId;
    if (typeof data.disputeId === "string") safeData.disputeId = data.disputeId;
  }

  return {
    title,
    body,
    linkUrl,
    data: safeData,
  };
}
