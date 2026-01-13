/**
 * Unit tests for update-manager.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useServiceWorkerUpdate, updateServiceWorker } from "../update-manager";
import { renderHook } from "@testing-library/react";

// Mock register-service-worker
vi.mock("../register-service-worker", () => ({
  getServiceWorkerRegistration: vi.fn(),
  checkForServiceWorkerUpdate: vi.fn(),
  isServiceWorkerSupported: vi.fn(() => true),
  setupUpdateListener: vi.fn(() => () => {}),
  reloadClients: vi.fn(() => {}),
}));

describe("update-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useServiceWorkerUpdate", () => {
    it("should return update state and functions", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      expect(result.current).toHaveProperty("updateAvailable");
      expect(result.current).toHaveProperty("isInstalling");
      expect(result.current).toHaveProperty("registration");
      expect(result.current).toHaveProperty("checkForUpdate");
      expect(result.current).toHaveProperty("installUpdate");
      expect(result.current).toHaveProperty("state");
    });

    it("should have updateAvailable as false initially", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      expect(result.current.updateAvailable).toBe(false);
    });

    it("should have isInstalling as false initially", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      expect(result.current.isInstalling).toBe(false);
    });
  });

  describe("updateServiceWorker", () => {
    it("should throw error when service worker is not supported", async () => {
      const { isServiceWorkerSupported } =
        await import("../register-service-worker");
      vi.mocked(isServiceWorkerSupported).mockReturnValue(false);

      await expect(updateServiceWorker()).rejects.toThrow(
        "Service workers are not supported",
      );
    });

    it("should handle update when registration exists", async () => {
      const { isServiceWorkerSupported, getServiceWorkerRegistration } =
        await import("../register-service-worker");
      const { checkForServiceWorkerUpdate, reloadClients } =
        await import("../register-service-worker");

      // Ensure service worker is supported for this test
      vi.mocked(isServiceWorkerSupported).mockReturnValue(true);
      vi.mocked(checkForServiceWorkerUpdate).mockResolvedValue(true);
      vi.mocked(reloadClients).mockImplementation(() => {});

      let stateChangeHandler: EventListener | null = null;
      const mockWorker = {
        state: "installed",
        postMessage: vi.fn(),
        addEventListener: vi.fn((event: string, handler: EventListener) => {
          if (event === "statechange") {
            stateChangeHandler = handler;
            // Immediately trigger statechange to activated
            (mockWorker as any).state = "activated";
            // Use queueMicrotask to ensure it runs after current execution
            queueMicrotask(() => {
              if (stateChangeHandler) {
                const event = {
                  type: "statechange",
                  target: mockWorker,
                } as unknown as Event;
                stateChangeHandler(event);
              }
            });
          }
        }),
      };

      const mockRegistration = {
        waiting: mockWorker,
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(getServiceWorkerRegistration).mockResolvedValue(
        mockRegistration,
      );

      await expect(updateServiceWorker()).resolves.toBeUndefined();
    }, 10000); // Increase timeout to 10 seconds
  });
});
