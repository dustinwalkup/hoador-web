/**
 * PWA Provider Component
 *
 * Client component that registers the service worker and manages
 * PWA-related functionality. This component should be added to the
 * app layout to enable service worker registration.
 */

"use client";

import { useEffect } from "react";
import { useServiceWorker } from "@/lib/pwa/use-service-worker";
import { initializeInstallPrompt } from "@/lib/pwa/install-prompt";

export interface PWAProviderProps {
  /** Children to render */
  children?: React.ReactNode;
  /** Callback when service worker update is available */
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
}

/**
 * PWA Provider Component
 *
 * Registers service worker on mount and manages service worker lifecycle.
 * This component should be added to the root layout or providers component.
 *
 * @param props - Component props
 */
export function PWAProvider({ children, onUpdateAvailable }: PWAProviderProps) {
  // Register service worker - the hook handles all the lifecycle management
  useServiceWorker({
    autoRegister: true,
    checkForUpdates: true,
    onUpdateAvailable,
  });

  // Initialize install prompt detection
  useEffect(() => {
    initializeInstallPrompt();
  }, []);

  // Component doesn't render anything, just manages service worker registration
  return <>{children}</>;
}
