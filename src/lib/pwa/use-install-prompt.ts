/**
 * React Hook for Install Prompt
 *
 * Provides a React hook for managing PWA installation prompts.
 * This hook manages the install prompt state and provides functions
 * to show the prompt and detect installation status.
 */

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  initializeInstallPrompt,
  showInstallPrompt,
  isAppInstalled,
  isInstallPromptDismissed,
  dismissInstallPrompt,
  dismissInstallPromptTemporarily,
  clearDismissedStatus,
  subscribeToInstallPromptState,
  isInstallPromptSupported,
} from "./install-prompt";
import type { InstallPromptState } from "./types";

/**
 * Return type for useInstallPrompt hook
 */
export interface UseInstallPromptReturn {
  /** Current install prompt state */
  state: InstallPromptState;
  /** Whether install prompt is supported in this browser */
  isSupported: boolean;
  /** Whether the app is installed */
  isInstalled: boolean;
  /** Whether the app is installable (prompt available) */
  isInstallable: boolean;
  /** Whether the prompt was dismissed by the user */
  isDismissed: boolean;
  /** Show the install prompt */
  showPrompt: () => Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  /** Dismiss the install prompt permanently (mark as dismissed) */
  dismiss: () => void;
  /** Dismiss the install prompt temporarily (remind again after 7 days) */
  remindLater: () => void;
  /** Clear dismissed status (useful for testing) */
  clearDismissed: () => void;
  /** Whether installation is in progress */
  isInstalling: boolean;
  /** Error that occurred during installation */
  error: Error | null;
}

/**
 * React hook for managing PWA installation prompts
 *
 * This hook initializes install prompt detection, manages state,
 * and provides functions to show and dismiss the install prompt.
 *
 * @example
 * ```tsx
 * const { isInstallable, showPrompt, isDismissed, dismiss } = useInstallPrompt();
 *
 * if (isInstallable && !isDismissed) {
 *   return (
 *     <button onClick={() => showPrompt()}>
 *       Install App
 *     </button>
 *   );
 * }
 * ```
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  // Use lazy initialization to avoid calling functions during render
  const [state, setState] = useState<InstallPromptState>(() => ({
    deferredPrompt: null,
    isInstallable: false,
    isInstalled: isAppInstalled(),
    userChoice: null,
  }));
  const [isDismissed, setIsDismissed] = useState(() =>
    isInstallPromptDismissed(),
  );
  // isSupported never changes after initialization, so derive it directly
  const isSupported = useMemo(() => isInstallPromptSupported(), []);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize on mount
  useEffect(() => {
    // Initialize install prompt detection
    initializeInstallPrompt();

    // Subscribe to state changes
    const unsubscribe = subscribeToInstallPromptState((newState) => {
      setState(newState);
      setIsDismissed(isInstallPromptDismissed());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Show install prompt
  const handleShowPrompt = useCallback(async () => {
    if (!state.isInstallable || state.isInstalled) {
      return Promise.resolve({
        outcome: "dismissed" as const,
        platform: "unknown",
      });
    }

    setIsInstalling(true);
    setError(null);

    try {
      const result = await showInstallPrompt();
      setIsInstalling(false);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsInstalling(false);
      throw error;
    }
  }, [state.isInstallable, state.isInstalled]);

  // Dismiss prompt permanently
  const handleDismiss = useCallback(() => {
    dismissInstallPrompt();
    setIsDismissed(true);
  }, []);

  // Dismiss prompt temporarily (remind later)
  const handleRemindLater = useCallback(() => {
    dismissInstallPromptTemporarily();
    setIsDismissed(true);
  }, []);

  // Clear dismissed status
  const handleClearDismissed = useCallback(() => {
    clearDismissedStatus();
    setIsDismissed(false);
  }, []);

  return {
    state,
    isSupported,
    isInstalled: state.isInstalled,
    isInstallable: state.isInstallable,
    isDismissed,
    showPrompt: handleShowPrompt,
    dismiss: handleDismiss,
    remindLater: handleRemindLater,
    clearDismissed: handleClearDismissed,
    isInstalling,
    error,
  };
}
