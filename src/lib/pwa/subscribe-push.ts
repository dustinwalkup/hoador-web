/**
 * Client utility for subscribing to push notifications via the Push API.
 * Requirements: 2.8, 3.4
 */

/** Shape of push subscription payload sent to the API */
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

const PUSH_SUPPORTED =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

/**
 * Converts a base64url-encoded VAPID public key to Uint8Array for use with
 * PushManager.subscribe(applicationServerKey).
 *
 * @param vapidPublicKey - Base64 or base64url-encoded VAPID public key
 * @returns Uint8Array representation of the key
 */
function vapidKeyToUint8Array(vapidPublicKey: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
  const base64 = (vapidPublicKey + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribes the current service worker to push notifications.
 * Uses navigator.serviceWorker.ready, then PushManager.subscribe with the
 * given VAPID public key. Returns a JSON-serializable subscription object
 * suitable for sending to POST /api/push/subscribe.
 *
 * @param vapidPublicKey - Base64 or base64url-encoded VAPID public key from env
 * @returns Push subscription payload (endpoint, keys) to send to API, or null if unavailable/failed
 */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<PushSubscriptionPayload | null> {
  if (!PUSH_SUPPORTED || !vapidPublicKey) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const pushManager = registration.pushManager;
    if (!pushManager) {
      return null;
    }

    const applicationServerKey = vapidKeyToUint8Array(vapidPublicKey);
    const subscription = await pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!json.endpoint || !p256dh || !auth) {
      console.warn("[subscribeToPush] Subscription missing endpoint or keys");
      return null;
    }
    return {
      endpoint: json.endpoint,
      keys: { p256dh, auth },
      expirationTime: json.expirationTime ?? null,
    };
  } catch (error) {
    console.warn("[subscribeToPush] Subscription failed:", error);
    return null;
  }
}
