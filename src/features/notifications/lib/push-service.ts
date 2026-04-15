import webpush from "web-push";
import { pushSubscriptionDAL } from "@/dal";
import type { PushSubscriptionRow } from "@/dal/notifications.dal";
import { getLogger } from "@/lib/logger";
import type { PushPayload } from "./push-payload";

const EVENT_TYPE_PUSH_SEND = "push_send";

const LOG_PUSH_DEBUG = process.env.LOG_PUSH_DEBUG === "true";

let vapidInitialized = false;

function hasVapidEnvKeys(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

/**
 * Whether server env includes both VAPID keys (for diagnostics and `/api/push/test` JSON).
 * Does not guarantee `web-push` initialized successfully.
 *
 * @returns True if public and private key env vars are non-empty
 */
export function isPushVapidConfigured(): boolean {
  return hasVapidEnvKeys();
}

/**
 * Initialize web-push with VAPID keys from env. No-op if keys missing; logs warning.
 * Call once at module load or before first send.
 */
function ensureVapidInitialized(): boolean {
  if (vapidInitialized) return true;

  if (!hasVapidEnvKeys()) {
    console.warn(
      "[push-service] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY missing; push notifications disabled.",
    );
    return false;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY!;
  const privateKey = process.env.VAPID_PRIVATE_KEY!;

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:support@hoador.com",
      publicKey,
      privateKey,
    );
    vapidInitialized = true;
    return true;
  } catch (err) {
    console.warn("[push-service] Failed to set VAPID details:", err);
    return false;
  }
}

/**
 * Convert DB subscription row to the shape web-push expects.
 */
function toWebPushSubscription(row: PushSubscriptionRow): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  return {
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
}

/**
 * Send push to a single subscription. On 410/404 deactivates subscription; logs audit; retries once on 5xx.
 * Returns true if sent successfully, false otherwise.
 * Requirements: 3.6, 10.1, 10.2, 11.1
 */
export async function sendToSubscription(
  subscriptionRow: PushSubscriptionRow,
  payload: PushPayload,
  userId: string,
): Promise<boolean> {
  const subscription = toWebPushSubscription(subscriptionRow);
  const payloadStr = JSON.stringify(payload);
  const eventType = payload.data?.type ?? EVENT_TYPE_PUSH_SEND;

  const trySend = async (): Promise<boolean> => {
    try {
      await webpush.sendNotification(subscription, payloadStr);
      await pushSubscriptionDAL.createAuditLog(
        userId,
        subscriptionRow.id,
        eventType,
        true,
        null,
      );
      return true;
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? (err as { statusCode: number }).statusCode
          : undefined;

      if (statusCode === 410 || statusCode === 404) {
        await pushSubscriptionDAL.deactivate(subscriptionRow.id);
        await pushSubscriptionDAL.createAuditLog(
          userId,
          subscriptionRow.id,
          eventType,
          false,
          `Subscription expired or not found (${statusCode})`,
        );
        return false;
      }

      if (statusCode && statusCode >= 500 && statusCode < 600) {
        throw err;
      }

      await pushSubscriptionDAL.createAuditLog(
        userId,
        subscriptionRow.id,
        eventType,
        false,
        err instanceof Error ? err.message : String(err),
      );
      return false;
    }
  };

  try {
    return await trySend();
  } catch (retryableErr) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      return await trySend();
    } catch {
      await pushSubscriptionDAL.createAuditLog(
        userId,
        subscriptionRow.id,
        eventType,
        false,
        retryableErr instanceof Error
          ? retryableErr.message
          : String(retryableErr),
      );
      return false;
    }
  }
}

/**
 * Send push to all active subscriptions for a user. Fire-and-forget: does not await per-subscription sends.
 * Requirements: 3.6, 7.3, 8.2, 8.3
 */
export async function sendPush(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapidInitialized()) {
    if (LOG_PUSH_DEBUG) {
      getLogger({ userId }).info(
        { userId, reason: "vapid_missing", event: "push_send_skip" },
        "Push send skipped: VAPID not configured",
      );
    }
    return;
  }

  const subscriptions = await pushSubscriptionDAL.getActiveByUserId(userId);
  if (!subscriptions?.length) {
    if (LOG_PUSH_DEBUG) {
      getLogger({ userId }).info(
        {
          userId,
          reason: "no_subscriptions",
          subscriptionCount: 0,
          event: "push_send_skip",
        },
        "Push send skipped: no active subscriptions for user",
      );
    }
    return;
  }

  if (LOG_PUSH_DEBUG) {
    getLogger({ userId }).info(
      {
        userId,
        subscriptionCount: subscriptions.length,
        event: "push_send_dispatch",
      },
      "Dispatching push to device subscriptions",
    );
  }

  for (const sub of subscriptions) {
    sendToSubscription(sub, payload, userId).catch((err) => {
      getLogger({ userId }).error(
        { err, event: "sendToSubscription_failed", userId },
        "[push-service] sendToSubscription failed",
      );
    });
  }
}
