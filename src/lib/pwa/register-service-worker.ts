/**
 * Service Worker Registration Utility
 *
 * Provides functions for registering service workers, checking for updates,
 * and managing service worker lifecycle. Includes browser detection and
 * error handling for robust service worker management.
 */

import type { ServiceWorkerState } from "./types";

/**
 * Service worker registration options
 */
export interface RegistrationOptions {
  /** Service worker script URL (default: /sw.js) */
  scriptURL?: string;
  /** Service worker scope (default: /) */
  scope?: string;
  /** Whether to update on registration (default: true) */
  updateOnRegistration?: boolean;
}

/**
 * Default service worker registration options
 */
const DEFAULT_OPTIONS: Required<RegistrationOptions> = {
  scriptURL: "/sw.js",
  scope: "/",
  updateOnRegistration: true,
};

/**
 * Check if service workers are supported in the current browser
 */
export function isServiceWorkerSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "serviceWorker" in navigator &&
    typeof navigator.serviceWorker !== "undefined"
  );
}

/**
 * Check if we're running over HTTPS (required for service workers except localhost)
 *
 * Service workers require a secure context (HTTPS) except for localhost
 * for development purposes. This function validates the security context.
 */
export function isSecureContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Check if browser supports secure context API
  if (typeof window.isSecureContext !== "undefined") {
    return window.isSecureContext;
  }

  // Fallback: Check protocol and hostname
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  // HTTPS is secure
  if (protocol === "https:") {
    return true;
  }

  // Localhost and 127.0.0.1 are allowed for development
  if (
    protocol === "http:" &&
    (hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("127.0.0.1") ||
      hostname === "[::1]")
  ) {
    return true;
  }

  // All other HTTP contexts are not secure
  return false;
}

/**
 * Check if service worker registration is possible
 */
export function canRegisterServiceWorker(): boolean {
  return isServiceWorkerSupported() && isSecureContext();
}

/**
 * Register the service worker
 *
 * @param options - Registration options
 * @returns Promise resolving to ServiceWorkerRegistration or null if registration fails
 */
export async function registerServiceWorker(
  options: RegistrationOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  // Check browser support
  if (!canRegisterServiceWorker()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[SW] Service worker registration not supported or not in secure context",
      );
    }
    return null;
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Security: Verify HTTPS requirement
  if (!isSecureContext()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[SW] Service worker requires HTTPS (or localhost). Current context is not secure.",
      );
    }
    return null;
  }

  // Security: Validate service worker script URL
  try {
    const scriptURL = new URL(opts.scriptURL, window.location.origin);
    if (scriptURL.origin !== window.location.origin) {
      console.error(
        "[SW] Service worker script must be from the same origin",
        scriptURL.origin,
        "!=",
        window.location.origin,
      );
      return null;
    }
  } catch (error) {
    console.error("[SW] Invalid service worker script URL:", error);
    return null;
  }

  // Security: Validate scope
  try {
    const scopeURL = new URL(opts.scope, window.location.origin);
    if (scopeURL.origin !== window.location.origin) {
      console.error(
        "[SW] Service worker scope must be from the same origin",
        scopeURL.origin,
        "!=",
        window.location.origin,
      );
      return null;
    }
    // Ensure scope is within app root (security: prevent parent directory access)
    if (!scopeURL.pathname.startsWith("/")) {
      console.error("[SW] Service worker scope must start with /");
      return null;
    }
  } catch (error) {
    console.error("[SW] Invalid service worker scope:", error);
    return null;
  }

  try {
    // Use requestIdleCallback for non-blocking registration if available
    // Otherwise register immediately but don't block
    const register = async () => {
      const registration = await navigator.serviceWorker.register(
        opts.scriptURL,
        {
          scope: opts.scope,
          updateViaCache: "none", // Always check for updates
        },
      );

      if (process.env.NODE_ENV === "development") {
        console.log(
          "[SW] Service worker registered successfully",
          registration,
        );
      }

      // Check for updates on registration if requested (non-blocking)
      if (opts.updateOnRegistration) {
        // Don't await - let it run in background
        checkForServiceWorkerUpdate(registration).catch((error) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[SW] Update check failed:", error);
          }
        });
      }

      return registration;
    };

    // Use requestIdleCallback for non-blocking registration when available
    if (
      typeof window !== "undefined" &&
      "requestIdleCallback" in window &&
      typeof window.requestIdleCallback === "function"
    ) {
      return new Promise((resolve) => {
        window.requestIdleCallback(
          async () => {
            try {
              const registration = await register();
              resolve(registration);
            } catch (error) {
              console.error("[SW] Service worker registration failed:", error);
              resolve(null);
            }
          },
          { timeout: 2000 }, // Fallback after 2 seconds
        );
      });
    }

    // Fallback: register immediately (still async, non-blocking)
    try {
      return await register();
    } catch (error) {
      console.error("[SW] Service worker registration failed:", error);
      return null;
    }
  } catch (error) {
    console.error("[SW] Service worker registration failed:", error);
    return null;
  }
}

/**
 * Check for service worker updates
 *
 * @param registration - Service worker registration object (optional, will get current if not provided)
 * @returns Promise resolving to boolean indicating if update is available
 */
export async function checkForServiceWorkerUpdate(
  registration?: ServiceWorkerRegistration,
): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const reg =
      registration || (await navigator.serviceWorker.getRegistration());

    if (!reg) {
      return false;
    }

    // Try to update the service worker
    await reg.update();

    // Check if there's a waiting service worker
    if (reg.waiting) {
      if (process.env.NODE_ENV === "development") {
        console.log("[SW] Update available (waiting)");
      }
      return true;
    }

    // Check if there's an installing service worker
    if (reg.installing) {
      if (process.env.NODE_ENV === "development") {
        console.log("[SW] Update available (installing)");
      }
      return true;
    }

    // Listen for updatefound event if no waiting/installing worker
    return new Promise((resolve) => {
      const checkUpdate = () => {
        if (reg.waiting || reg.installing) {
          reg.removeEventListener("updatefound", checkUpdate);
          if (process.env.NODE_ENV === "development") {
            console.log("[SW] Update found");
          }
          resolve(true);
        }
      };

      // Check immediately
      if (reg.waiting || reg.installing) {
        resolve(true);
        return;
      }

      // Listen for updatefound event
      reg.addEventListener("updatefound", checkUpdate);

      // Timeout after 5 seconds
      setTimeout(() => {
        reg.removeEventListener("updatefound", checkUpdate);
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    console.error("[SW] Error checking for updates:", error);
    return false;
  }
}

/**
 * Get current service worker registration
 *
 * @returns Promise resolving to ServiceWorkerRegistration or null
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ?? null;
  } catch (error) {
    console.error("[SW] Error getting registration:", error);
    return null;
  }
}

/**
 * Get service worker state from registration
 *
 * @param registration - Service worker registration object
 * @returns ServiceWorkerState object
 */
export function getServiceWorkerState(
  registration: ServiceWorkerRegistration | null,
): ServiceWorkerState {
  if (!registration) {
    return {
      registration: null,
      updateAvailable: false,
      installing: false,
      waiting: false,
      active: false,
      error: null,
    };
  }

  return {
    registration,
    updateAvailable: !!(registration.waiting || registration.installing),
    installing: !!registration.installing,
    waiting: !!registration.waiting,
    active: !!registration.active,
    error: null,
  };
}

/**
 * Clear all service worker caches
 *
 * Useful for clearing cached data on logout or when needed.
 * This ensures sensitive data is removed from cache.
 *
 * @returns Promise resolving to boolean indicating success
 */
export async function clearServiceWorkerCache(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const cacheNames = await caches.keys();

    // Delete all caches
    await Promise.all(
      cacheNames.map((cacheName) => {
        console.log(`[SW] Deleting cache: ${cacheName}`);
        return caches.delete(cacheName);
      }),
    );

    if (process.env.NODE_ENV === "development") {
      console.log("[SW] All caches cleared");
    }

    return true;
  } catch (error) {
    console.error("[SW] Error clearing caches:", error);
    return false;
  }
}

/**
 * Unregister service worker (useful for development/testing)
 *
 * @returns Promise resolving to boolean indicating success
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration) {
      const success = await registration.unregister();
      if (process.env.NODE_ENV === "development") {
        console.log("[SW] Service worker unregistered:", success);
      }
      return success;
    }

    return false;
  } catch (error) {
    console.error("[SW] Error unregistering service worker:", error);
    return false;
  }
}

/**
 * Reload all clients when service worker update is installed
 * This should be called after installing an update via skipWaiting
 * Note: Only call this once to avoid multiple listeners
 */
let reloadListenerAdded = false;

export function reloadClients(): void {
  if (
    typeof window !== "undefined" &&
    navigator.serviceWorker &&
    !reloadListenerAdded
  ) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
    reloadListenerAdded = true;
  }
}

/**
 * Setup update listener for service worker registration
 * Calls the callback when an update is detected
 *
 * @param registration - Service worker registration object
 * @param onUpdateAvailable - Callback to call when update is available
 */
export function setupUpdateListener(
  registration: ServiceWorkerRegistration,
  onUpdateAvailable: (registration: ServiceWorkerRegistration) => void,
): () => void {
  // Track state change handlers for cleanup
  const stateChangeHandlers = new Map<ServiceWorker, () => void>();
  // Flag to track if we've already notified about an update
  let hasNotified = false;

  const handleUpdateFound = () => {
    const newWorker = registration.installing || registration.waiting;

    if (!newWorker) {
      return;
    }

    // Create and store the state change handler
    const handleStateChange = () => {
      if (
        newWorker.state === "installed" &&
        navigator.serviceWorker.controller &&
        !hasNotified
      ) {
        // New service worker installed and waiting
        hasNotified = true;
        onUpdateAvailable(registration);
      }
    };

    stateChangeHandlers.set(newWorker, handleStateChange);
    newWorker.addEventListener("statechange", handleStateChange);
  };

  registration.addEventListener("updatefound", handleUpdateFound);

  // Check if there's already a waiting worker
  if (registration.waiting && !hasNotified) {
    hasNotified = true;
    onUpdateAvailable(registration);
  }

  // Return cleanup function that removes all listeners
  return () => {
    registration.removeEventListener("updatefound", handleUpdateFound);
    // Clean up all state change handlers
    stateChangeHandlers.forEach((handler, worker) => {
      worker.removeEventListener("statechange", handler);
    });
    stateChangeHandlers.clear();
  };
}
