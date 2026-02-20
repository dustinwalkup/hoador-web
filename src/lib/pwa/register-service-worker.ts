/**
 * Registers the service worker for push notifications.
 * Only runs in the browser; handles errors gracefully and does not throw.
 * Requirements: 2.5, 2.6, 2.7
 *
 * @returns The service worker registration, or null if not in browser or registration failed
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch (error) {
    console.warn("[registerServiceWorker] Registration failed:", error);
    return null;
  }
}
