/**
 * Unit tests for register-service-worker.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isServiceWorkerSupported,
  isSecureContext,
  canRegisterServiceWorker,
  registerServiceWorker,
  checkForServiceWorkerUpdate,
  getServiceWorkerRegistration,
  getServiceWorkerState,
  unregisterServiceWorker,
  clearServiceWorkerCache,
} from "../register-service-worker";

// Mock service worker APIs
const mockRegister = vi.fn();
const mockGetRegistration = vi.fn();
const mockUpdate = vi.fn();
const mockUnregister = vi.fn();

const createMockRegistration = () =>
  ({
    installing: null,
    waiting: null,
    active: {
      state: "activated",
    },
    update: mockUpdate,
    unregister: mockUnregister,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as ServiceWorkerRegistration;

const mockRegistration = createMockRegistration();

describe("register-service-worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    Object.defineProperty(navigator, "serviceWorker", {
      writable: true,
      value: {
        register: mockRegister,
        getRegistration: mockGetRegistration,
        controller: null,
      },
      configurable: true,
    });

    // Setup window properties (happy-dom should provide window)
    // Use the actual window object from globalThis
    const win = (globalThis as any).window;

    if (win) {
      Object.defineProperty(win, "isSecureContext", {
        writable: true,
        value: true,
        configurable: true,
      });

      Object.defineProperty(win, "location", {
        writable: true,
        value: {
          protocol: "https:",
          hostname: "localhost",
          origin: "https://localhost:3000",
        },
        configurable: true,
      });

      // Delete requestIdleCallback to ensure it's not available by default
      // Tests that need it can add it back
      if ("requestIdleCallback" in win) {
        delete (win as any).requestIdleCallback;
      }
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isServiceWorkerSupported", () => {
    it("should return true when serviceWorker is available", () => {
      expect(isServiceWorkerSupported()).toBe(true);
    });

    it("should return false when serviceWorker is not available", () => {
      Object.defineProperty(navigator, "serviceWorker", {
        writable: true,
        value: undefined,
        configurable: true,
      });

      expect(isServiceWorkerSupported()).toBe(false);
    });
  });

  describe("isSecureContext", () => {
    it("should return true for HTTPS", () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          protocol: "https:",
          hostname: "example.com",
        },
        configurable: true,
      });

      expect(isSecureContext()).toBe(true);
    });

    it("should return true for localhost", () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          protocol: "http:",
          hostname: "localhost",
        },
        configurable: true,
      });

      expect(isSecureContext()).toBe(true);
    });

    it("should return false for HTTP (non-localhost)", () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          protocol: "http:",
          hostname: "example.com",
        },
        configurable: true,
      });
      Object.defineProperty(window, "isSecureContext", {
        writable: true,
        value: false,
        configurable: true,
      });

      expect(isSecureContext()).toBe(false);
    });
  });

  describe("canRegisterServiceWorker", () => {
    it("should return true when both service worker and secure context are available", () => {
      expect(canRegisterServiceWorker()).toBe(true);
    });

    it("should return false when service worker is not supported", () => {
      Object.defineProperty(navigator, "serviceWorker", {
        writable: true,
        value: undefined,
        configurable: true,
      });

      expect(canRegisterServiceWorker()).toBe(false);
    });
  });

  describe("registerServiceWorker", () => {
    it("should register service worker successfully", async () => {
      mockRegister.mockResolvedValue(mockRegistration);

      const result = await registerServiceWorker();

      expect(result).toBe(mockRegistration);
      expect(mockRegister).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    });

    it("should return null when service worker is not supported", async () => {
      Object.defineProperty(navigator, "serviceWorker", {
        writable: true,
        value: undefined,
        configurable: true,
      });

      const result = await registerServiceWorker();

      expect(result).toBeNull();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it("should return null when not in secure context", async () => {
      Object.defineProperty(window, "isSecureContext", {
        writable: true,
        value: false,
        configurable: true,
      });
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          protocol: "http:",
          hostname: "example.com",
        },
        configurable: true,
      });

      const result = await registerServiceWorker();

      expect(result).toBeNull();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it("should handle registration errors", async () => {
      // Ensure requestIdleCallback is not available to use the immediate path
      const win = globalThis.window || (globalThis as any).window;
      if (win) {
        // Delete the property instead of setting to undefined
        delete (win as any).requestIdleCallback;
      }

      // Clear any previous mock implementations
      mockRegister.mockReset();
      mockRegister.mockRejectedValue(new Error("Registration failed"));

      const result = await registerServiceWorker();

      expect(result).toBeNull();
      expect(mockRegister).toHaveBeenCalled();
    });

    it("should validate script URL origin", async () => {
      const result = await registerServiceWorker({
        scriptURL: "https://evil.com/sw.js",
      });

      expect(result).toBeNull();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it("should validate scope origin", async () => {
      const result = await registerServiceWorker({
        scope: "https://evil.com/",
      });

      expect(result).toBeNull();
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe("checkForServiceWorkerUpdate", () => {
    it("should check for updates", async () => {
      // Create a fresh mock registration with update method
      const mockUpdateFn = vi.fn().mockResolvedValue(undefined);
      const mockRegWithWaiting = {
        installing: null,
        waiting: {
          state: "installed",
        },
        active: {
          state: "activated",
        },
        update: mockUpdateFn,
        unregister: mockUnregister,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      // Mock getRegistration to return our registration
      mockGetRegistration.mockResolvedValue(mockRegWithWaiting);

      const result = await checkForServiceWorkerUpdate();

      // update() should be called before checking for waiting worker
      expect(mockUpdateFn).toHaveBeenCalled();
      // Since waiting exists, result should be true
      expect(result).toBe(true);
    });

    it("should return false when no registration exists", async () => {
      mockGetRegistration.mockResolvedValue(null);

      const result = await checkForServiceWorkerUpdate();

      expect(result).toBe(false);
    });
  });

  describe("getServiceWorkerRegistration", () => {
    it("should get registration", async () => {
      mockGetRegistration.mockResolvedValue(mockRegistration);

      const result = await getServiceWorkerRegistration();

      expect(result).toBe(mockRegistration);
    });

    it("should return null when no registration exists", async () => {
      mockGetRegistration.mockResolvedValue(null);

      const result = await getServiceWorkerRegistration();

      expect(result).toBeNull();
    });
  });

  describe("getServiceWorkerState", () => {
    it("should return state from registration", () => {
      const state = getServiceWorkerState(mockRegistration);

      expect(state.registration).toBe(mockRegistration);
      expect(state.active).toBe(true);
      expect(state.updateAvailable).toBe(false);
    });

    it("should return default state when registration is null", () => {
      const state = getServiceWorkerState(null);

      expect(state.registration).toBeNull();
      expect(state.active).toBe(false);
      expect(state.updateAvailable).toBe(false);
    });
  });

  describe("clearServiceWorkerCache", () => {
    it("should clear all caches", async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);
      const mockKeys = vi
        .fn()
        .mockResolvedValue(["cache-1", "cache-2", "cache-3"]);

      (global as any).caches = {
        keys: mockKeys,
        delete: mockDelete,
      };

      const result = await clearServiceWorkerCache();

      expect(result).toBe(true);
      expect(mockKeys).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalledTimes(3);
    });

    it("should return false when service worker is not supported", async () => {
      Object.defineProperty(navigator, "serviceWorker", {
        writable: true,
        value: undefined,
        configurable: true,
      });

      const result = await clearServiceWorkerCache();

      expect(result).toBe(false);
    });
  });

  describe("unregisterServiceWorker", () => {
    it("should unregister service worker", async () => {
      mockGetRegistration.mockResolvedValue(mockRegistration);
      mockUnregister.mockResolvedValue(true);

      const result = await unregisterServiceWorker();

      expect(result).toBe(true);
      expect(mockUnregister).toHaveBeenCalled();
    });

    it("should return false when no registration exists", async () => {
      mockGetRegistration.mockResolvedValue(null);

      const result = await unregisterServiceWorker();

      expect(result).toBe(false);
    });
  });
});
