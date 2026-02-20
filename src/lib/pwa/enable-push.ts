/**
 * Client-side flow to enable push notifications: register SW, request permission,
 * subscribe, and POST subscription to API. Use for manual "Enable Push" and
 * post-action prompts (e.g. after rental request submit or first approval).
 */

import { registerServiceWorker } from "./register-service-worker";
import { requestPushPermission } from "./use-push-permission";
import { subscribeToPush } from "./subscribe-push";

const VAPID_PUBLIC_KEY =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "")
    : "";

export type EnablePushResult =
  | { success: true }
  | {
      success: false;
      reason: "unsupported" | "denied" | "subscribe_failed" | "api_failed";
      message?: string;
    };

/**
 * Registers the service worker (if needed), requests notification permission,
 * subscribes to push, and sends the subscription to POST /api/push/subscribe.
 * Only runs in the browser.
 *
 * @returns Result indicating success or failure reason
 */
export async function enablePush(): Promise<EnablePushResult> {
  if (typeof window === "undefined") {
    return { success: false, reason: "unsupported", message: "Not in browser" };
  }

  if (!VAPID_PUBLIC_KEY) {
    return {
      success: false,
      reason: "unsupported",
      message: "VAPID public key not configured",
    };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      success: false,
      reason: "unsupported",
      message: "Push not supported",
    };
  }

  try {
    let registration: ServiceWorkerRegistration | null | undefined =
      await navigator.serviceWorker.getRegistration("/");
    if (!registration) {
      registration = await registerServiceWorker();
    }
    if (!registration) {
      return {
        success: false,
        reason: "subscribe_failed",
        message: "Service worker registration failed",
      };
    }

    const permission = await requestPushPermission();
    if (permission !== "granted") {
      return { success: false, reason: "denied" };
    }

    const subscription = await subscribeToPush(VAPID_PUBLIC_KEY);
    if (!subscription) {
      return {
        success: false,
        reason: "subscribe_failed",
        message: "Could not create push subscription",
      };
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        reason: "api_failed",
        message:
          (data as { error?: string }).error ?? "Failed to save subscription",
      };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      reason: "subscribe_failed",
      message,
    };
  }
}
