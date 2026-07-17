import webpush from "web-push";
import { pushSubscriptionDAL } from "@/dal";
import {
  isWebSubscriptionRow,
  isNativeSubscriptionRow,
  type PushSubscriptionRow,
} from "@/dal/notifications.dal";
import { getLogger } from "@/lib/logger";
import type { PushPayload } from "./push-payload";
import { sendExpoPush } from "./expo-push-service";

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
 *
 * Takes a row already narrowed by `isWebSubscriptionRow`: `p256dh`/`auth` are
 * nullable columns since native push landed, so the caller must prove the row
 * is a well-formed web subscription rather than trusting the column types.
 */
function toWebPushSubscription(
  row: PushSubscriptionRow & { p256dh: string; auth: string },
): {
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
  // This path is web-push only; `sendPush` routes native rows to `sendExpoPush`.
  // The guard stays because the function is exported and independently callable,
  // and because `p256dh`/`auth` are nullable columns now — a `web` row with a
  // null key is corrupt and must be skipped, not handed to web-push (F1).
  if (!isWebSubscriptionRow(subscriptionRow)) {
    if (LOG_PUSH_DEBUG) {
      getLogger({ userId }).debug(
        {
          event: "sendToSubscription_skipped_non_web",
          platform: subscriptionRow.platform,
          subscriptionId: subscriptionRow.id,
        },
        "[push-service] skipping subscription that is not a well-formed web row",
      );
    }
    return false;
  }

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

  // Partition before gating. The VAPID check used to sit at the top of this
  // function and return early for everyone — which, once native landed, would
  // have dropped every Expo push in any environment without VAPID keys, with no
  // error anywhere. The gate belongs to the web branch only.
  // Requirements: 2.2.2. Spec: epic-02-backend-services.md (F5, D-E2-3).
  const webSubscriptions = subscriptions.filter(isWebSubscriptionRow);
  const nativeSubscriptions = subscriptions.filter(isNativeSubscriptionRow);

  if (LOG_PUSH_DEBUG) {
    getLogger({ userId }).info(
      {
        userId,
        subscriptionCount: subscriptions.length,
        webCount: webSubscriptions.length,
        nativeCount: nativeSubscriptions.length,
        event: "push_send_dispatch",
      },
      "Dispatching push to device subscriptions",
    );
  }

  // Native (Expo). Requirements: 2.2.2.
  if (nativeSubscriptions.length) {
    sendExpoPush(userId, nativeSubscriptions, payload).catch((err) => {
      getLogger({ userId }).error(
        { err, event: "sendExpoPush_failed", userId },
        "[push-service] sendExpoPush failed",
      );
    });
  }

  // Web (VAPID). Unchanged behavior, until the post-GA decommission (Req 2.2.7).
  if (!webSubscriptions.length) return;
  if (!ensureVapidInitialized()) {
    if (LOG_PUSH_DEBUG) {
      getLogger({ userId }).info(
        { userId, reason: "vapid_missing", event: "push_send_skip_web" },
        "Web push send skipped: VAPID not configured (native sends unaffected)",
      );
    }
    return;
  }

  for (const sub of webSubscriptions) {
    sendToSubscription(sub, payload, userId).catch((err) => {
      getLogger({ userId }).error(
        { err, event: "sendToSubscription_failed", userId },
        "[push-service] sendToSubscription failed",
      );
    });
  }
}
