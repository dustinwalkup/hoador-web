/**
 * Unit tests for install-prompt.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isAppInstalled,
  isInstallPromptDismissed,
  dismissInstallPrompt,
  clearDismissedStatus,
  markAppAsInstalled,
  getInstallPromptState,
  captureInstallPrompt,
  showInstallPrompt,
  isInstallPromptSupported,
  isManualInstallAvailable,
  getSafariInstallInstructions,
} from "../install-prompt";

describe("install-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset window properties
    Object.defineProperty(window, "matchMedia", {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
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
      localStorage.setItem("pwa-install-status", "installed");

      expect(isAppInstalled()).toBe(true);
    });

    it("should return false when not installed", () => {
      expect(isAppInstalled()).toBe(false);
    });
  });

  describe("isInstallPromptDismissed", () => {
    it("should return true when dismissed", () => {
      localStorage.setItem("pwa-install-prompt-dismissed", "true");

      expect(isInstallPromptDismissed()).toBe(true);
    });

    it("should return false when not dismissed", () => {
      expect(isInstallPromptDismissed()).toBe(false);
    });
  });

  describe("dismissInstallPrompt", () => {
    it("should mark prompt as dismissed", () => {
      dismissInstallPrompt();

      const stored = localStorage.getItem("pwa-install-prompt-dismissed");
      expect(stored).not.toBeNull();
      const dismissal = JSON.parse(stored!);
      expect(dismissal.type).toBe("never");
      expect(dismissal.timestamp).toBeTypeOf("number");
    });
  });

  describe("clearDismissedStatus", () => {
    it("should clear dismissed status", () => {
      localStorage.setItem("pwa-install-prompt-dismissed", "true");

      clearDismissedStatus();

      expect(localStorage.getItem("pwa-install-prompt-dismissed")).toBeNull();
    });
  });

  describe("markAppAsInstalled", () => {
    it("should mark app as installed", () => {
      markAppAsInstalled();

      expect(localStorage.getItem("pwa-install-status")).toBe("installed");
    });
  });

  describe("getInstallPromptState", () => {
    it("should return install prompt state", () => {
      const state = getInstallPromptState();

      expect(state).toHaveProperty("deferredPrompt");
      expect(state).toHaveProperty("isInstallable");
      expect(state).toHaveProperty("isInstalled");
      expect(state).toHaveProperty("userChoice");
    });
  });

  describe("isInstallPromptSupported", () => {
    it("should return true when beforeinstallprompt is available", () => {
      Object.defineProperty(window, "onbeforeinstallprompt", {
        writable: true,
        value: null,
        configurable: true,
      });

      expect(isInstallPromptSupported()).toBe(true);
    });

    it("should return false when beforeinstallprompt is not available", () => {
      delete (window as any).onbeforeinstallprompt;

      expect(isInstallPromptSupported()).toBe(false);
    });
  });

  describe("captureInstallPrompt", () => {
    it("should capture beforeinstallprompt event", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      captureInstallPrompt();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "beforeinstallprompt",
        expect.any(Function),
      );
    });

    it("should not capture if already installed", () => {
      localStorage.setItem("pwa-install-status", "installed");
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      captureInstallPrompt();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });
  });

  describe("showInstallPrompt", () => {
    it("should throw error when prompt is not available", async () => {
      await expect(showInstallPrompt()).rejects.toThrow(
        "Install prompt not available",
      );
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
      localStorage.setItem("pwa-install-status", "installed");

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
