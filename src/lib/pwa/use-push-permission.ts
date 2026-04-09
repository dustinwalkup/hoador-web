"use client";

/**
 * Hook and utilities for push notification permission state and prompting.
 * Tracks "has been prompted" via localStorage to avoid repeated prompts.
 * Requirements: 4.1, 4.5, 4.6, 5.4, 5.5
 *
 * In-app push permission prompts are shown only on mobile; shouldOfferPushOnDevice()
 * gates those prompts. Preference toggles for push remain available on all devices.
 */

import { useCallback, useSyncExternalStore } from "react";
import { isMobileDevice } from "./install-prompt";

const STORAGE_KEY = "push-permission-prompted";

function getPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

function getSnapshot(): NotificationPermission {
  return getPermission();
}

/** Neutral value during SSR so UI does not assume blocked before hydration. */
function getServerSnapshot(): NotificationPermission {
  return "default";
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => callback();
  window.addEventListener("focus", handler);
  return () => window.removeEventListener("focus", handler);
}

/**
 * Returns whether in-app push permission prompts should be shown on this device.
 * Prompts are shown only on mobile; desktop users do not see the post-request or
 * first-approval prompt (they can still adjust push preferences in settings).
 *
 * @returns true only when running on client and isMobileDevice() is true
 */
export function shouldOfferPushOnDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return isMobileDevice();
}

/**
 * Returns whether the user has not yet been prompted and permission is still "default".
 * Use this to decide whether to show an in-app prompt before calling requestPushPermission.
 *
 * @returns true if permission is "default" and we have not yet recorded a prompt
 */
export function shouldShowPermissionPrompt(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission !== "default") {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) !== "true";
  } catch {
    return true;
  }
}

/**
 * Records that the user has been shown the push permission prompt.
 * Call after showing the prompt (whether they accept or dismiss).
 */
export function markPromptShown(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // ignore
  }
}

/**
 * Requests push notification permission from the browser.
 * Resolves with the new permission value (granted | denied | default).
 *
 * @returns Promise resolving to the permission result
 */
export function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return Promise.resolve("denied");
  }
  return Notification.requestPermission();
}

/**
 * Hook that exposes push permission state and prompt helpers.
 * Permission updates when the user grants/denies and the window regains focus.
 *
 * @returns permission, requestPushPermission, shouldShowPermissionPrompt, markPromptShown
 */
export function usePushPermission(): {
  permission: NotificationPermission;
  requestPushPermission: () => Promise<NotificationPermission>;
  shouldShowPermissionPrompt: () => boolean;
  markPromptShown: () => void;
} {
  const permission = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const request = useCallback(() => requestPushPermission(), []);
  const shouldShow = useCallback(() => shouldShowPermissionPrompt(), []);
  const markShown = useCallback(() => markPromptShown(), []);

  return {
    permission,
    requestPushPermission: request,
    shouldShowPermissionPrompt: shouldShow,
    markPromptShown: markShown,
  };
}
