/**
 * Unit tests for use-push-permission.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shouldOfferPushOnDevice,
  shouldShowPermissionPrompt,
  markPromptShown,
} from "../use-push-permission";

vi.mock("../install-prompt", () => ({
  isMobileDevice: vi.fn(),
}));

import { isMobileDevice } from "../install-prompt";

describe("use-push-permission", () => {
  beforeEach(() => {
    vi.mocked(isMobileDevice).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      localStorage.removeItem("push-permission-prompted");
    } catch {
      // ignore
    }
  });

  describe("shouldOfferPushOnDevice", () => {
    it("returns false when isMobileDevice is false (desktop)", () => {
      vi.mocked(isMobileDevice).mockReturnValue(false);
      expect(shouldOfferPushOnDevice()).toBe(false);
    });

    it("returns true when isMobileDevice is true (mobile)", () => {
      vi.mocked(isMobileDevice).mockReturnValue(true);
      expect(shouldOfferPushOnDevice()).toBe(true);
    });
  });

  describe("shouldShowPermissionPrompt", () => {
    it("returns false when Notification permission is not default", () => {
      Object.defineProperty(window, "Notification", {
        writable: true,
        value: { permission: "granted" },
        configurable: true,
      });
      expect(shouldShowPermissionPrompt()).toBe(false);
    });

    it("returns false when user has already been prompted", () => {
      Object.defineProperty(window, "Notification", {
        writable: true,
        value: { permission: "default" },
        configurable: true,
      });
      localStorage.setItem("push-permission-prompted", "true");
      expect(shouldShowPermissionPrompt()).toBe(false);
    });
  });

  describe("markPromptShown", () => {
    it("stores prompted state in localStorage", () => {
      markPromptShown();
      expect(localStorage.getItem("push-permission-prompted")).toBe("true");
    });
  });
});
