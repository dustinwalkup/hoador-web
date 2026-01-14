/**
 * React Hook for Install Directions
 *
 * Simplified hook for managing PWA install directions display.
 * Provides dismissal utilities and installation status detection.
 * Does not handle beforeinstallprompt (removed).
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isAppInstalled,
  isInstallPromptDismissed,
  dismissInstallPrompt,
  dismissInstallPromptTemporarily,
  detectBrowser,
} from "./install-prompt";

/**
 * Browser detection result (exported for use in components)
 */
export interface BrowserInfo {
  name: string;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isDesktop: boolean;
}

/**
 * Instruction step with icon
 */
export interface InstructionStep {
  icon: string; // lucide-react icon name
  text: string;
}

/**
 * Get device-specific installation instructions with icons
 */
function getInstallInstructions(): {
  title: string;
  steps: InstructionStep[];
} {
  const browser = detectBrowser();

  // iOS Safari
  if (browser.name === "safari" && browser.isIOS) {
    return {
      title: "Install on iOS",
      steps: [
        {
          icon: "Share2",
          text: "Tap the Share button (square with upward arrow) at the bottom of your Safari browser",
        },
        {
          icon: "Plus",
          text: "Scroll down in the share menu and tap 'Add to Home Screen'",
        },
        {
          icon: "Check",
          text: "Review the app name and icon, then tap 'Add' in the top right corner",
        },
        {
          icon: "Home",
          text: "Find Hoador on your home screen and tap to open it",
        },
      ],
    };
  }

  // macOS Safari
  if (browser.name === "safari" && browser.isDesktop) {
    return {
      title: "Install on macOS",
      steps: [
        {
          icon: "Share2",
          text: "Click the Share button in the Safari toolbar (or press Cmd+Shift+I)",
        },
        {
          icon: "Plus",
          text: "Select 'Add to Dock' or 'Add to Home Screen' from the share menu",
        },
        {
          icon: "Check",
          text: "Confirm the installation when prompted",
        },
        {
          icon: "Home",
          text: "Open Hoador from your Dock or Launchpad",
        },
      ],
    };
  }

  // Android Chrome
  if (browser.name === "chrome" && browser.isAndroid) {
    return {
      title: "Install on Android",
      steps: [
        {
          icon: "MoreVertical",
          text: "Tap the menu button (three vertical dots) in the top right corner of Chrome",
        },
        {
          icon: "Download",
          text: "Tap 'Install app' or 'Add to Home screen' from the menu",
        },
        {
          icon: "Check",
          text: "Review the permissions and tap 'Install' in the confirmation dialog",
        },
        {
          icon: "Home",
          text: "The Hoador app will appear on your home screen - tap to launch",
        },
      ],
    };
  }

  // Desktop Chrome/Edge
  if (
    (browser.name === "chrome" || browser.name === "edge") &&
    browser.isDesktop
  ) {
    return {
      title: "Install on Desktop",
      steps: [
        {
          icon: "Download",
          text: "Look for the install icon (computer with plus) in your browser's address bar and click it",
        },
        {
          icon: "MoreVertical",
          text: "Or click the menu button (three dots) → 'Install Hoador' or 'Apps' → 'Install this site as an app'",
        },
        {
          icon: "Check",
          text: "Click 'Install' in the confirmation popup that appears",
        },
        {
          icon: "Smartphone",
          text: "Hoador will open in its own app window without browser controls",
        },
      ],
    };
  }

  // Generic fallback
  return {
    title: "Install Hoador",
    steps: [
      {
        icon: "Menu",
        text: "Look for an install option in your browser's menu or settings",
      },
      {
        icon: "Plus",
        text: "Search for 'Add to Home screen', 'Install app', or 'Create shortcut'",
      },
      {
        icon: "Home",
        text: "Once installed, access Hoador from your home screen or app launcher",
      },
    ],
  };
}

/**
 * Return type for useInstallDirections hook
 */
export interface UseInstallDirectionsReturn {
  /** Whether the app is installed */
  isInstalled: boolean;
  /** Whether the prompt was dismissed by the user */
  isDismissed: boolean;
  /** Dismiss the install prompt permanently (mark as dismissed) */
  dismiss: () => void;
  /** Dismiss the install prompt temporarily (remind again after 7 days) */
  remindLater: () => void;
  /** Installation instructions for the current device/browser */
  instructions: {
    title: string;
    steps: InstructionStep[];
  };
  /** Browser information */
  browser: BrowserInfo;
}

/**
 * React hook for managing PWA install directions
 *
 * This hook provides utilities for showing install directions
 * and managing dismissal state. It does not handle beforeinstallprompt.
 *
 * @example
 * ```tsx
 * const { isInstalled, isDismissed, dismiss, remindLater, instructions } = useInstallDirections();
 *
 * if (!isInstalled && !isDismissed) {
 *   return <InstallBanner instructions={instructions} onDismiss={dismiss} onRemindLater={remindLater} />;
 * }
 * ```
 */
export function useInstallDirections(): UseInstallDirectionsReturn {
  const [isInstalled, setIsInstalled] = useState(() => isAppInstalled());
  const [isDismissed, setIsDismissed] = useState(() =>
    isInstallPromptDismissed(),
  );

  // Check installation status periodically (in case user installs while on page)
  useEffect(() => {
    const checkInstalled = () => {
      setIsInstalled(isAppInstalled());
      setIsDismissed(isInstallPromptDismissed());
    };

    // Check immediately
    checkInstalled();

    // Check periodically (every 5 seconds) to catch installation
    const interval = setInterval(checkInstalled, 5000);

    return () => clearInterval(interval);
  }, []);

  // Dismiss permanently
  const handleDismiss = useCallback(() => {
    dismissInstallPrompt();
    setIsDismissed(true);
  }, []);

  // Dismiss temporarily (remind later)
  const handleRemindLater = useCallback(() => {
    dismissInstallPromptTemporarily();
    setIsDismissed(true);
  }, []);

  const browser = detectBrowser();
  const instructions = getInstallInstructions();

  return {
    isInstalled,
    isDismissed,
    dismiss: handleDismiss,
    remindLater: handleRemindLater,
    instructions,
    browser,
  };
}
