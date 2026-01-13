/**
 * React Hook for Service Worker Registration
 *
 * Provides a React hook for managing service worker registration and state.
 * This hook handles registration on mount, update detection, and state management.
 */

"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { ServiceWorkerState } from "./types";
import {
  registerServiceWorker,
  checkForServiceWorkerUpdate,
  getServiceWorkerRegistration,
  getServiceWorkerState,
  setupUpdateListener,
  reloadClients as reloadClientsUtil,
  canRegisterServiceWorker,
  isServiceWorkerSupported,
  type RegistrationOptions,
} from "./register-service-worker";

/**
 * Options for useServiceWorker hook
 */
export interface UseServiceWorkerOptions extends RegistrationOptions {
  /** Whether to automatically register on mount (default: true) */
  autoRegister?: boolean;
  /** Whether to check for updates on mount (default: true) */
  checkForUpdates?: boolean;
  /** Callback when an update is available */
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
}

/**
 * Return type for useServiceWorker hook
 */
export interface UseServiceWorkerReturn {
  /** Current service worker state */
  state: ServiceWorkerState;
  /** Whether service worker is supported in current browser */
  isSupported: boolean;
  /** Whether service worker can be registered */
  canRegister: boolean;
  /** Function to manually register service worker */
  register: () => Promise<ServiceWorkerRegistration | null>;
  /** Function to check for updates */
  checkForUpdates: () => Promise<boolean>;
  /** Function to reload clients after update */
  reloadClients: () => void;
  /** Whether registration is in progress */
  isRegistering: boolean;
}

/**
 * React hook for service worker registration and management
 *
 * @param options - Configuration options for service worker registration
 * @returns Service worker state and control functions
 */
export function useServiceWorker(
  options: UseServiceWorkerOptions = {},
): UseServiceWorkerReturn {
  const {
    autoRegister = true,
    checkForUpdates: shouldCheckForUpdates = true,
    onUpdateAvailable,
    scriptURL,
    scope,
    updateOnRegistration,
  } = options;

  // Memoize registration options to prevent infinite loops
  const registrationOptions = useMemo<RegistrationOptions>(
    () => ({
      ...(scriptURL !== undefined && { scriptURL }),
      ...(scope !== undefined && { scope }),
      ...(updateOnRegistration !== undefined && { updateOnRegistration }),
    }),
    [scriptURL, scope, updateOnRegistration],
  );

  const [state, setState] = useState<ServiceWorkerState>({
    registration: null,
    updateAvailable: false,
    installing: false,
    waiting: false,
    active: false,
    error: null,
  });

  const [isRegistering, setIsRegistering] = useState(false);
  const [isSupported] = useState(() => isServiceWorkerSupported());
  const [canRegister] = useState(() => canRegisterServiceWorker());

  /**
   * Update state from registration (only if values actually changed)
   */
  const updateState = useCallback(
    (registration: ServiceWorkerRegistration | null) => {
      const newState = getServiceWorkerState(registration);
      setState((prevState) => {
        // Only update if any value actually changed
        if (
          prevState.registration === newState.registration &&
          prevState.updateAvailable === newState.updateAvailable &&
          prevState.installing === newState.installing &&
          prevState.waiting === newState.waiting &&
          prevState.active === newState.active &&
          prevState.error === newState.error
        ) {
          return prevState; // Return same reference to prevent re-render
        }
        return newState;
      });
    },
    [],
  );

  /**
   * Register service worker
   */
  const register = useCallback(async () => {
    if (!canRegister) {
      console.warn("[SW] Service worker cannot be registered");
      return null;
    }

    setIsRegistering(true);
    try {
      const registration = await registerServiceWorker(registrationOptions);
      updateState(registration);

      if (registration && shouldCheckForUpdates) {
        await checkForServiceWorkerUpdate(registration);
        updateState(registration);
      }

      return registration;
    } catch (error) {
      console.error("[SW] Registration error:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return null;
    } finally {
      setIsRegistering(false);
    }
  }, [canRegister, registrationOptions, shouldCheckForUpdates, updateState]);

  /**
   * Check for service worker updates
   */
  const checkForUpdates = useCallback(async () => {
    if (!isSupported) {
      return false;
    }

    try {
      const registration = await getServiceWorkerRegistration();
      if (!registration) {
        return false;
      }

      const hasUpdate = await checkForServiceWorkerUpdate(registration);
      updateState(registration);
      return hasUpdate;
    } catch (error) {
      console.error("[SW] Error checking for updates:", error);
      return false;
    }
  }, [isSupported, updateState]);

  /**
   * Reload clients after update
   */
  const reloadClients = useCallback(() => {
    reloadClientsUtil();
  }, []);

  // Register service worker on mount if autoRegister is true
  // Use a ref to track if we've already registered to prevent duplicate registrations
  const hasRegisteredRef = useRef(false);

  useEffect(() => {
    if (!autoRegister || !canRegister || hasRegisteredRef.current) {
      return;
    }

    hasRegisteredRef.current = true;

    // Get existing registration first
    getServiceWorkerRegistration()
      .then((registration) => {
        if (registration) {
          updateState(registration);
        } else {
          // No existing registration, register new one
          register();
        }
      })
      .catch((error) => {
        console.error("[SW] Error getting registration:", error);
      });
    // Note: We intentionally only run this once on mount when conditions are met
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRegister, canRegister]);

  // Setup update listener when registration is available
  // Store onUpdateAvailable in a ref to prevent effect re-runs when callback changes
  const onUpdateAvailableRef = useRef(onUpdateAvailable);
  onUpdateAvailableRef.current = onUpdateAvailable;

  useEffect(() => {
    if (!state.registration) {
      return;
    }

    const cleanup = setupUpdateListener(state.registration, (registration) => {
      updateState(registration);
      onUpdateAvailableRef.current?.(registration);
    });

    return cleanup;
  }, [state.registration, updateState]);

  // Check for updates periodically (every 5 minutes)
  useEffect(() => {
    if (!shouldCheckForUpdates || !state.registration) {
      return;
    }

    const interval = setInterval(
      () => {
        checkForUpdates();
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [shouldCheckForUpdates, state.registration, checkForUpdates]);

  return {
    state,
    isSupported,
    canRegister,
    register,
    checkForUpdates,
    reloadClients,
    isRegistering,
  };
}
