/**
 * Unit tests for install-prompt.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isAppInstalled,
  isInstallPromptDismissed,
  dismissInstallPrompt,
  dismissInstallPromptTemporarily,
  clearDismissedStatus,
  markAppAsInstalled,
  isManualInstallAvailable,
  getSafariInstallInstructions,
} from "../install-prompt";

describe("install-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear localStorage if available
    try {
      const win = globalThis as any;
      if (win.window?.localStorage) {
        win.window.localStorage.clear();
      } else if (win.localStorage) {
        win.localStorage.clear();
      }
    } catch {
      // localStorage not available, functions will handle it
    }

    // Reset window.matchMedia if available
    try {
      const win = globalThis as any;
      if (win.window) {
        Object.defineProperty(win.window, "matchMedia", {
          writable: true,
          value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          })),
          configurable: true,
        });
      }
    } catch {
      // window not available
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      const win = globalThis as any;
      if (win.window?.localStorage) {
        win.window.localStorage.clear();
      } else if (win.localStorage) {
        win.localStorage.clear();
      }
    } catch {
      // localStorage not available
    }
  });

  describe("isAppInstalled", () => {
    it("should return true when in standalone mode", () => {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === "(display-mode: standalone)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
        configurable: true,
      });

      expect(isAppInstalled()).toBe(true);
    });

    it("should return true when localStorage indicates installed", () => {
      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        storage.setItem("pwa-install-status", "installed");
      }

      expect(isAppInstalled()).toBe(true);
    });

    it("should return false when not installed", () => {
      expect(isAppInstalled()).toBe(false);
    });
  });

  describe("isInstallPromptDismissed", () => {
    it("should return true when dismissed with old format (backward compatibility)", () => {
      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        storage.setItem("pwa-install-prompt-dismissed", "true");
      }

      expect(isInstallPromptDismissed()).toBe(true);
    });

    it("should return true when dismissed with 'never' type", () => {
      const dismissal = JSON.stringify({
        type: "never",
        timestamp: Date.now(),
      });
      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        storage.setItem("pwa-install-prompt-dismissed", dismissal);
      }

      expect(isInstallPromptDismissed()).toBe(true);
    });

    it("should return true when dismissed with 'remind_later' and within 7 days", () => {
      const dismissal = JSON.stringify({
        type: "remind_later",
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
      });
      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        storage.setItem("pwa-install-prompt-dismissed", dismissal);
      }

      expect(isInstallPromptDismissed()).toBe(true);
    });

    it("should return false when dismissed with 'remind_later' but expired", () => {
      const dismissal = JSON.stringify({
        type: "remind_later",
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 8, // 8 days ago (expired)
      });
      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        storage.setItem("pwa-install-prompt-dismissed", dismissal);
      }

      expect(isInstallPromptDismissed()).toBe(false);
    });

    it("should return false when not dismissed", () => {
      expect(isInstallPromptDismissed()).toBe(false);
    });
  });

  describe("dismissInstallPrompt", () => {
    it("should mark prompt as dismissed permanently", () => {
      dismissInstallPrompt();

      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        const stored = storage.getItem("pwa-install-prompt-dismissed");
        expect(stored).not.toBeNull();
        const dismissal = JSON.parse(stored!);
        expect(dismissal.type).toBe("never");
        expect(dismissal.timestamp).toBeTypeOf("number");
      }
    });
  });

  describe("dismissInstallPromptTemporarily", () => {
    it("should mark prompt as dismissed temporarily", () => {
      dismissInstallPromptTemporarily();

      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        const stored = storage.getItem("pwa-install-prompt-dismissed");
        expect(stored).not.toBeNull();
        const dismissal = JSON.parse(stored!);
        expect(dismissal.type).toBe("remind_later");
        expect(dismissal.timestamp).toBeTypeOf("number");
      }
    });

    it("should be dismissed when within 7 days", () => {
      dismissInstallPromptTemporarily();

      expect(isInstallPromptDismissed()).toBe(true);
    });
  });

  describe("clearDismissedStatus", () => {
    it("should clear dismissed status", () => {
      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        storage.setItem("pwa-install-prompt-dismissed", "true");

        clearDismissedStatus();

        expect(storage.getItem("pwa-install-prompt-dismissed")).toBeNull();
      }
    });
  });

  describe("markAppAsInstalled", () => {
    it("should mark app as installed", () => {
      markAppAsInstalled();

      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        expect(storage.getItem("pwa-install-status")).toBe("installed");
      }
    });
  });

  describe("isManualInstallAvailable", () => {
    it("should return true for Safari when not installed", () => {
      Object.defineProperty(navigator, "userAgent", {
        writable: true,
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        configurable: true,
      });

      expect(isManualInstallAvailable()).toBe(true);
    });

    it("should return false when already installed", () => {
      const win = globalThis as any;
      const storage = win.window?.localStorage || win.localStorage;
      if (storage) {
        storage.setItem("pwa-install-status", "installed");
      }

      expect(isManualInstallAvailable()).toBe(false);
    });
  });

  describe("getSafariInstallInstructions", () => {
    it("should return iOS instructions for iOS", () => {
      Object.defineProperty(navigator, "userAgent", {
        writable: true,
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        configurable: true,
      });

      const instructions = getSafariInstallInstructions();

      expect(instructions.title).toBe("Install on iOS");
      expect(instructions.steps.length).toBeGreaterThan(0);
    });

    it("should return macOS instructions for desktop", () => {
      Object.defineProperty(navigator, "userAgent", {
        writable: true,
        value:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        configurable: true,
      });
      Object.defineProperty(navigator, "platform", {
        writable: true,
        value: "MacIntel",
        configurable: true,
      });

      const instructions = getSafariInstallInstructions();

      expect(instructions.title).toBe("Install on macOS");
      expect(instructions.steps.length).toBeGreaterThan(0);
    });
  });
});
