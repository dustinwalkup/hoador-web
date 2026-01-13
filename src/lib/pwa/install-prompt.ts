/**
 * Install Prompt Utility
 *
 * Handles PWA installation prompts, including capturing the beforeinstallprompt
 * event and providing functions to trigger installation. Also includes install
 * status detection to determine if the app is already installed.
 * Includes Safari-specific handling for iOS and macOS.
 */

import type { BeforeInstallPromptEvent, InstallPromptState } from "./types";

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
function detectBrowser(): BrowserInfo {
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
// const REMIND_LATER_DURATION = 0;

/**
 * Dismissal data structure
 */
interface DismissalData {
  type: "never" | "remind_later";
  timestamp: number;
}

/**
 * Module-level storage for deferred install prompt
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Module-level storage for install prompt state
 */
const installPromptState: InstallPromptState = {
  deferredPrompt: null,
  isInstallable: false,
  isInstalled: false,
  userChoice: null,
};

/**
 * Listeners for install prompt state changes
 */
const stateListeners = new Set<(state: InstallPromptState) => void>();

/**
 * Flag to track if initialization has been performed
 */
let isInitialized = false;

/**
 * Flag to track if event listeners have been added
 */
let eventListenersAdded = false;

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
    installPromptState.isInstalled = true;
    notifyStateListeners();
  } catch (error) {
    console.warn("[PWA] Failed to save installation status:", error);
  }
}

/**
 * Get the current install prompt state
 *
 * @returns Current install prompt state
 */
export function getInstallPromptState(): InstallPromptState {
  return { ...installPromptState };
}

/**
 * Subscribe to install prompt state changes
 *
 * @param listener - Callback function to call when state changes
 * @returns Unsubscribe function
 */
export function subscribeToInstallPromptState(
  listener: (state: InstallPromptState) => void,
): () => void {
  stateListeners.add(listener);

  // Immediately call with current state
  listener(getInstallPromptState());

  // Return unsubscribe function
  return () => {
    stateListeners.delete(listener);
  };
}

/**
 * Notify all state listeners of state changes
 */
function notifyStateListeners(): void {
  const currentState = getInstallPromptState();
  stateListeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch (error) {
      console.error("[PWA] Error in state listener:", error);
    }
  });
}

/**
 * Capture the beforeinstallprompt event
 *
 * This should be called once when the page loads to capture the
 * browser's install prompt event.
 */
export function captureInstallPrompt(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Check if already captured
  if (deferredPrompt !== null) {
    return;
  }

  // Check if event listeners have already been added (prevent duplicates)
  if (eventListenersAdded) {
    return;
  }

  // Check if already installed
  if (isAppInstalled()) {
    installPromptState.isInstalled = true;
    installPromptState.isInstallable = false;
    notifyStateListeners();
    return;
  }

  // Mark that we're adding event listeners
  eventListenersAdded = true;

  // Listen for beforeinstallprompt event
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    // Prevent the default install prompt
    e.preventDefault();

    // Store the event for later use
    const promptEvent = e as BeforeInstallPromptEvent;
    deferredPrompt = promptEvent;

    // Update state
    installPromptState.deferredPrompt = promptEvent;
    installPromptState.isInstallable = true;
    installPromptState.isInstalled = false;

    notifyStateListeners();
  });

  // Listen for appinstalled event (user installed the app)
  window.addEventListener("appinstalled", () => {
    // Clear the deferred prompt
    deferredPrompt = null;

    // Update state
    installPromptState.deferredPrompt = null;
    installPromptState.isInstallable = false;
    installPromptState.isInstalled = true;
    installPromptState.userChoice = "accepted";

    // Mark as installed in localStorage
    markAppAsInstalled();

    notifyStateListeners();
  });
}

/**
 * Show the install prompt
 *
 * This triggers the browser's install prompt. The prompt must have been
 * captured first using captureInstallPrompt().
 *
 * @returns Promise that resolves with the user's choice
 */
export async function showInstallPrompt(): Promise<{
  outcome: "accepted" | "dismissed";
  platform: string;
}> {
  if (!deferredPrompt) {
    throw new Error(
      "Install prompt not available. Make sure to call captureInstallPrompt() first.",
    );
  }

  if (isAppInstalled()) {
    throw new Error("App is already installed");
  }

  try {
    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for user's choice
    const choiceResult = await deferredPrompt.userChoice;

    // Update state
    installPromptState.userChoice = choiceResult.outcome;
    installPromptState.isInstallable = false;
    deferredPrompt = null;
    installPromptState.deferredPrompt = null;

    // If accepted, mark as installed
    if (choiceResult.outcome === "accepted") {
      markAppAsInstalled();
    }

    notifyStateListeners();

    return choiceResult;
  } catch (error) {
    console.error("[PWA] Failed to show install prompt:", error);
    throw error;
  }
}

/**
 * Check if install prompt is supported in the current browser
 *
 * @returns Whether install prompt is supported
 */
export function isInstallPromptSupported(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Safari (iOS and macOS) doesn't support beforeinstallprompt
  // but supports manual installation
  const browser = detectBrowser();
  if (browser.name === "safari") {
    return false; // Manual installation only
  }

  // Check for beforeinstallprompt event support
  return "onbeforeinstallprompt" in window;
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

/**
 * Initialize install prompt detection
 *
 * Call this once when the app loads to set up install prompt detection
 * and status checking.
 */
export function initializeInstallPrompt(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Prevent multiple initializations
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  // Update installed status
  installPromptState.isInstalled = isAppInstalled();

  // Capture install prompt if not installed
  if (!installPromptState.isInstalled) {
    captureInstallPrompt();
  } else {
    installPromptState.isInstallable = false;
  }

  notifyStateListeners();
}
