/**
 * Install Prompt Utility
 *
 * Simplified utility for PWA installation status detection and dismissal tracking.
 * No longer handles beforeinstallprompt API - only provides installation detection
 * and dismissal utilities.
 */

/**
 * Browser detection result
 */
interface BrowserInfo {
  /** Browser name (chrome, firefox, safari, edge, samsung, unknown) */
  name: string;
  /** Whether running on iOS */
  isIOS: boolean;
  /** Whether running on Android */
  isAndroid: boolean;
  /** Whether running on mobile device */
  isMobile: boolean;
  /** Whether running on desktop */
  isDesktop: boolean;
}

/**
 * Detect the current browser
 *
 * @returns Browser information
 */
export function detectBrowser(): BrowserInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      name: "unknown",
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isDesktop: true,
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || "";

  const isIOS =
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === "macintel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(userAgent);
  const isMobile = isIOS || isAndroid || /mobile/.test(userAgent);

  let browserName = "unknown";
  if (/chrome/.test(userAgent) && !/edg|opr/.test(userAgent)) {
    browserName = "chrome";
  } else if (/edg/.test(userAgent)) {
    browserName = "edge";
  } else if (/firefox/.test(userAgent)) {
    browserName = "firefox";
  } else if (
    /safari/.test(userAgent) &&
    !/chrome|crios|fxios/.test(userAgent)
  ) {
    browserName = "safari";
  } else if (/samsungbrowser/.test(userAgent)) {
    browserName = "samsung";
  }

  return {
    name: browserName,
    isIOS,
    isAndroid,
    isMobile,
    isDesktop: !isMobile,
  };
}

/**
 * Storage key for tracking dismissed install prompts
 */
const DISMISSED_PROMPT_KEY = "pwa-install-prompt-dismissed";

/**
 * Storage key for tracking installation status
 */
const INSTALL_STATUS_KEY = "pwa-install-status";

/**
 * Duration for "remind me later" dismissal (7 days in milliseconds)
 */
const REMIND_LATER_DURATION = 7 * 24 * 60 * 60 * 1000;

/**
 * Dismissal data structure
 */
interface DismissalData {
  type: "never" | "remind_later";
  timestamp: number;
}

/**
 * Check if running on a mobile device
 *
 * @returns Whether running on a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || "";

  const isIOS =
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === "macintel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(userAgent);
  return isIOS || isAndroid || /mobile/.test(userAgent);
}

/**
 * Check if the app is installed
 *
 * Detects installation status using multiple methods:
 * - Display mode check (standalone mode indicates installation)
 * - localStorage check (persisted installation status)
 * - matchMedia check (for iOS Safari)
 *
 * @returns Whether the app is installed
 */
export function isAppInstalled(): boolean {
  // Check if running in standalone mode (installed PWA)
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return true;
  }

  // Check if running in standalone mode on iOS Safari
  if (
    typeof window !== "undefined" &&
    // @ts-expect-error - iOS Safari specific property
    (window.navigator.standalone === true ||
      (window.matchMedia("(display-mode: standalone)").matches &&
        // @ts-expect-error - iOS Safari specific property
        !window.navigator.standalone))
  ) {
    return true;
  }

  // Check localStorage for persisted installation status
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(INSTALL_STATUS_KEY);
      if (stored === "installed") {
        return true;
      }
    } catch (error) {
      // localStorage may not be available in some contexts
      console.warn("[PWA] Failed to check installation status:", error);
    }
  }

  return false;
}

/**
 * Check if the install prompt was dismissed by the user
 *
 * Handles both old format (boolean string) and new format (JSON with type and timestamp).
 * For "remind_later" dismissals, checks if the 7-day period has expired.
 *
 * @returns Whether the prompt was dismissed
 */
export function isInstallPromptDismissed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const stored = localStorage.getItem(DISMISSED_PROMPT_KEY);
    if (!stored) {
      return false;
    }

    // Handle old format (backward compatibility)
    if (stored === "true") {
      // Migrate to new format
      const dismissal: DismissalData = {
        type: "never",
        timestamp: Date.now(),
      };
      localStorage.setItem(DISMISSED_PROMPT_KEY, JSON.stringify(dismissal));
      return true;
    }

    // Handle new format
    try {
      const dismissal: DismissalData = JSON.parse(stored);

      if (dismissal.type === "never") {
        return true; // Permanently dismissed
      }

      if (dismissal.type === "remind_later") {
        const elapsed = Date.now() - dismissal.timestamp;
        // Return true if still within the 7-day period (dismissed)
        // Return false if expired (should show again)
        return elapsed < REMIND_LATER_DURATION;
      }

      // Unknown type, treat as not dismissed
      return false;
    } catch (parseError) {
      // Invalid JSON, treat as not dismissed
      console.warn("[PWA] Failed to parse dismissal data:", parseError);
      return false;
    }
  } catch (error) {
    console.warn("[PWA] Failed to check dismissed status:", error);
    return false;
  }
}

/**
 * Mark the install prompt as permanently dismissed (never show again)
 */
export function dismissInstallPrompt(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const dismissal: DismissalData = {
      type: "never",
      timestamp: Date.now(),
    };
    localStorage.setItem(DISMISSED_PROMPT_KEY, JSON.stringify(dismissal));
  } catch (error) {
    console.warn("[PWA] Failed to save dismissed status:", error);
  }
}

/**
 * Mark the install prompt as temporarily dismissed (show again after 7 days)
 */
export function dismissInstallPromptTemporarily(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const dismissal: DismissalData = {
      type: "remind_later",
      timestamp: Date.now(),
    };
    localStorage.setItem(DISMISSED_PROMPT_KEY, JSON.stringify(dismissal));
  } catch (error) {
    console.warn("[PWA] Failed to save temporary dismissal status:", error);
  }
}

/**
 * Clear the dismissed status (useful for testing or after app updates)
 */
export function clearDismissedStatus(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(DISMISSED_PROMPT_KEY);
  } catch (error) {
    console.warn("[PWA] Failed to clear dismissed status:", error);
  }
}

/**
 * Mark the app as installed (call this after successful installation)
 */
export function markAppAsInstalled(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(INSTALL_STATUS_KEY, "installed");
  } catch (error) {
    console.warn("[PWA] Failed to save installation status:", error);
  }
}

/**
 * Check if manual installation is available (Safari)
 *
 * @returns Whether manual installation instructions should be shown
 */
export function isManualInstallAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const browser = detectBrowser();
  return browser.name === "safari" && !isAppInstalled();
}

/**
 * Get Safari installation instructions
 *
 * @returns Installation instructions for Safari
 */
export function getSafariInstallInstructions(): {
  title: string;
  steps: string[];
} {
  const browser = detectBrowser();

  if (browser.isIOS) {
    return {
      title: "Install on iOS",
      steps: [
        "Tap the Share button (square with arrow) at the bottom of the screen",
        "Scroll down and tap 'Add to Home Screen'",
        "Tap 'Add' in the top right corner",
        "The app will appear on your home screen",
      ],
    };
  }

  if (browser.isDesktop) {
    return {
      title: "Install on macOS",
      steps: [
        "Click the Share button in the Safari toolbar",
        "Select 'Add to Dock' or 'Add to Home Screen'",
        "The app will be added to your dock or home screen",
      ],
    };
  }

  return {
    title: "Install Hoador",
    steps: [
      "Use the Share menu in Safari",
      "Select 'Add to Home Screen'",
      "Follow the prompts to complete installation",
    ],
  };
}
