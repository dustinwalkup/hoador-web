/**
 * Network Status Utility
 *
 * Provides functions and hooks for detecting network connectivity status,
 * tracking online/offline state, and detecting network transitions.
 * Includes support for Network Information API for enhanced network details.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import type { NetworkStatus } from "./types";

/**
 * Network Information API interface (if supported)
 */
interface NetworkInformation extends EventTarget {
  readonly effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
  onchange?: ((this: NetworkInformation, ev: Event) => void) | null;
}

/**
 * Extended Navigator with Network Information API
 */
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

/**
 * Check if the device is currently online
 *
 * @returns Whether the device is online
 */
export function isOnline(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return true; // Assume online on server
  }

  return navigator.onLine;
}

/**
 * Get network information from Network Information API if available
 *
 * @returns Network information or undefined if not supported
 */
function getNetworkInformation(): Pick<
  NetworkStatus,
  "effectiveType" | "downlink" | "rtt"
> | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const nav = navigator as NavigatorWithConnection;
  const connection =
    nav.connection || nav.mozConnection || nav.webkitConnection;

  if (!connection) {
    return null;
  }

  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
  };
}

/**
 * Options for useNetworkStatus hook
 */
export interface UseNetworkStatusOptions {
  /** Whether to use Network Information API for enhanced details (default: true) */
  useNetworkInfo?: boolean;
  /** Callback when device comes online */
  onOnline?: () => void;
  /** Callback when device goes offline */
  onOffline?: () => void;
}

/**
 * Return type for useNetworkStatus hook
 */
export interface UseNetworkStatusReturn {
  /** Current network status */
  status: NetworkStatus;
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether the device is currently offline */
  isOffline: boolean;
  /** Whether the device was offline previously (for detecting transitions) */
  wasOffline: boolean;
  /** Whether this is the first render after coming back online */
  justCameOnline: boolean;
  /** Whether this is the first render after going offline */
  justWentOffline: boolean;
}

/**
 * React hook for network status detection
 *
 * Tracks online/offline state using navigator.onLine and online/offline events.
 * Optionally uses Network Information API for enhanced network details.
 * Detects transitions between online and offline states.
 *
 * @param options - Configuration options
 * @returns Network status information and state
 */
export function useNetworkStatus(
  options: UseNetworkStatusOptions = {},
): UseNetworkStatusReturn {
  const { useNetworkInfo = true, onOnline, onOffline } = options;

  const [isOnlineState, setIsOnlineState] = useState(() => isOnline());
  const [wasOffline, setWasOffline] = useState(() => !isOnline());
  const [justCameOnline, setJustCameOnline] = useState(false);
  const [justWentOffline, setJustWentOffline] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(() =>
    useNetworkInfo ? getNetworkInformation() : null,
  );

  /**
   * Update network status
   */
  const updateNetworkStatus = useCallback(() => {
    const online = isOnline();

    setIsOnlineState((prevOnline: boolean) => {
      const wasOnline = prevOnline;

      // Detect transitions
      if (!wasOnline && online) {
        // Just came online
        setJustCameOnline(true);
        setJustWentOffline(false);
        setWasOffline(false);
        onOnline?.();

        // Reset transition flag after a short delay
        setTimeout(() => setJustCameOnline(false), 100);
      } else if (wasOnline && !online) {
        // Just went offline
        setJustWentOffline(true);
        setJustCameOnline(false);
        setWasOffline(true);
        onOffline?.();

        // Reset transition flag after a short delay
        setTimeout(() => setJustWentOffline(false), 100);
      } else {
        // No transition
        setJustCameOnline(false);
        setJustWentOffline(false);
        setWasOffline(!online);
      }

      // Update network info if supported
      if (useNetworkInfo) {
        const info = getNetworkInformation();
        setNetworkInfo(info);
      }

      return online;
    });
  }, [useNetworkInfo, onOnline, onOffline]);

  /**
   * Handle online event
   */
  const handleOnline = useCallback(() => {
    updateNetworkStatus();
  }, [updateNetworkStatus]);

  /**
   * Handle offline event
   */
  const handleOffline = useCallback(() => {
    updateNetworkStatus();
  }, [updateNetworkStatus]);

  /**
   * Handle network information change (Network Information API)
   */
  const handleNetworkChange = useCallback(() => {
    if (useNetworkInfo) {
      const info = getNetworkInformation();
      setNetworkInfo(info);
    }
  }, [useNetworkInfo]);

  // Set up event listeners
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Listen to online/offline events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen to network information changes if supported
    if (useNetworkInfo) {
      const nav = navigator as NavigatorWithConnection;
      const connection =
        nav.connection || nav.mozConnection || nav.webkitConnection;

      if (connection) {
        connection.addEventListener("change", handleNetworkChange);
      }
    }

    // Clean up event listeners
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      if (useNetworkInfo) {
        const nav = navigator as NavigatorWithConnection;
        const connection =
          nav.connection || nav.mozConnection || nav.webkitConnection;

        if (connection) {
          connection.removeEventListener("change", handleNetworkChange);
        }
      }
    };
  }, [handleOnline, handleOffline, handleNetworkChange, useNetworkInfo]);

  // Build network status object
  const status: NetworkStatus = {
    isOnline: isOnlineState,
    wasOffline,
    ...(networkInfo || {}),
  };

  return {
    status,
    isOnline: isOnlineState,
    isOffline: !isOnlineState,
    wasOffline,
    justCameOnline,
    justWentOffline,
  };
}

/**
 * Check if Network Information API is supported
 *
 * @returns Whether Network Information API is supported
 */
export function isNetworkInfoSupported(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const nav = navigator as NavigatorWithConnection;
  return !!(nav.connection || nav.mozConnection || nav.webkitConnection);
}
