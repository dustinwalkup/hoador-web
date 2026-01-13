/**
 * Service Worker Update Manager
 *
 * Provides functions and hooks for detecting and installing service worker
 * updates. Tracks update availability and handles the update installation
 * lifecycle with user consent.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getServiceWorkerRegistration,
  setupUpdateListener,
  reloadClients,
  checkForServiceWorkerUpdate,
  isServiceWorkerSupported,
} from "./register-service-worker";
import type { ServiceWorkerState } from "./types";

/**
 * Options for useServiceWorkerUpdate hook
 */
export interface UseServiceWorkerUpdateOptions {
  /** Whether to automatically check for updates (default: true) */
  autoCheck?: boolean;
  /** Interval in milliseconds to check for updates (default: 5 minutes) */
  checkInterval?: number;
  /** Callback when an update is available */
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
}

/**
 * Return type for useServiceWorkerUpdate hook
 */
export interface UseServiceWorkerUpdateReturn {
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Whether an update is being installed */
  isInstalling: boolean;
  /** Service worker registration object */
  registration: ServiceWorkerRegistration | null;
  /** Function to check for updates manually */
  checkForUpdate: () => Promise<boolean>;
  /** Function to install the update (with user consent) */
  installUpdate: () => Promise<void>;
  /** Service worker state */
  state: ServiceWorkerState;
}

/**
 * React hook for service worker update management
 *
 * Detects service worker updates and provides functions to install them.
 * Can automatically check for updates at regular intervals.
 *
 * @param options - Configuration options
 * @returns Update state and control functions
 */
export function useServiceWorkerUpdate(
  options: UseServiceWorkerUpdateOptions = {},
): UseServiceWorkerUpdateReturn {
  const {
    autoCheck = true,
    checkInterval = 5 * 60 * 1000, // 5 minutes
    onUpdateAvailable,
  } = options;

  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [state, setState] = useState<ServiceWorkerState>({
    registration: null,
    updateAvailable: false,
    installing: false,
    waiting: false,
    active: false,
    error: null,
  });

  /**
   * Update state from registration
   */
  const updateState = useCallback(
    (reg: ServiceWorkerRegistration | null) => {
      if (!reg) {
        setState({
          registration: null,
          updateAvailable: false,
          installing: false,
          waiting: false,
          active: false,
          error: null,
        });
        setUpdateAvailable(false);
        return;
      }

      const hasUpdate = !!(reg.waiting || reg.installing);
      setState({
        registration: reg,
        updateAvailable: hasUpdate,
        installing: !!reg.installing,
        waiting: !!reg.waiting,
        active: !!reg.active,
        error: null,
      });
      setUpdateAvailable(hasUpdate);

      // Call callback if update becomes available
      if (hasUpdate && onUpdateAvailable) {
        onUpdateAvailable(reg);
      }
    },
    [onUpdateAvailable],
  );

  /**
   * Get and update registration state
   */
  const refreshRegistration = useCallback(async () => {
    if (!isServiceWorkerSupported()) {
      return;
    }

    try {
      const reg = await getServiceWorkerRegistration();
      setRegistration(reg);
      updateState(reg);
    } catch (error) {
      console.error("[SW] Error getting registration:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [updateState]);

  /**
   * Check for updates manually
   */
  const checkForUpdate = useCallback(async (): Promise<boolean> => {
    if (!isServiceWorkerSupported()) {
      return false;
    }

    try {
      const reg = await getServiceWorkerRegistration();
      if (!reg) {
        return false;
      }

      const hasUpdate = await checkForServiceWorkerUpdate(reg);
      setRegistration(reg);
      updateState(reg);

      return hasUpdate;
    } catch (error) {
      console.error("[SW] Error checking for updates:", error);
      return false;
    }
  }, [updateState]);

  /**
   * Install the update
   *
   * This sends a skipWaiting message to the waiting service worker
   * and reloads the page once the new service worker takes control.
   */
  const installUpdate = useCallback(async (): Promise<void> => {
    if (!registration || (!isInstalling && !registration.waiting)) {
      throw new Error("No update available to install");
    }

    setIsInstalling(true);

    try {
      const worker = registration.waiting || registration.installing;

      if (!worker) {
        throw new Error("No service worker available to update");
      }

      // Setup reload listener before skipWaiting
      reloadClients();

      // Send skipWaiting message to the service worker
      // The service worker should listen for this message and call skipWaiting()
      worker.postMessage({ type: "SKIP_WAITING" });

      // Wait for the worker to activate
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Update installation timeout"));
        }, 10000); // 10 second timeout

        worker.addEventListener(
          "statechange",
          () => {
            if (worker.state === "activated") {
              clearTimeout(timeout);
              setIsInstalling(false);
              resolve();
            } else if (worker.state === "redundant") {
              clearTimeout(timeout);
              setIsInstalling(false);
              reject(new Error("Service worker became redundant"));
            }
          },
          { once: true },
        );
      });
    } catch (error) {
      setIsInstalling(false);
      console.error("[SW] Error installing update:", error);
      throw error;
    }
  }, [registration, isInstalling]);

  // Get initial registration
  useEffect(() => {
    refreshRegistration();
  }, [refreshRegistration]);

  // Setup update listener
  useEffect(() => {
    if (!registration) {
      return;
    }

    const cleanup = setupUpdateListener(registration, (reg) => {
      setRegistration(reg);
      updateState(reg);
    });

    return cleanup;
  }, [registration, updateState]);

  // Auto-check for updates at interval
  useEffect(() => {
    if (!autoCheck || !registration) {
      return;
    }

    const interval = setInterval(() => {
      checkForUpdate();
    }, checkInterval);

    return () => clearInterval(interval);
  }, [autoCheck, checkInterval, registration, checkForUpdate]);

  return {
    updateAvailable,
    isInstalling,
    registration,
    checkForUpdate,
    installUpdate,
    state,
  };
}

/**
 * Install service worker update programmatically
 *
 * This is a standalone function that can be called from anywhere.
 * It gets the current registration, checks for updates, and installs them.
 *
 * @returns Promise that resolves when update is installed (or page is reloading)
 */
export async function updateServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    throw new Error("Service workers are not supported");
  }

  const registration = await getServiceWorkerRegistration();

  if (!registration) {
    throw new Error("Service worker not registered");
  }

  // Check for updates
  await checkForServiceWorkerUpdate(registration);

  const worker = registration.waiting;

  if (!worker) {
    // No update available
    return;
  }

  // Setup reload listener
  reloadClients();

  // Send skipWaiting message
  worker.postMessage({ type: "SKIP_WAITING" });

  // Wait for activation
  return new Promise<void>((resolve) => {
    worker.addEventListener(
      "statechange",
      () => {
        if (worker.state === "activated") {
          resolve();
        }
      },
      { once: true },
    );

    // Timeout after 10 seconds - page will reload anyway
    setTimeout(() => {
      resolve();
    }, 10000);
  });
}
