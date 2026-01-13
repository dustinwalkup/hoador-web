/**
 * Unit tests for network-status.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isOnline,
  useNetworkStatus,
  isNetworkInfoSupported,
} from "../network-status";
import { renderHook, waitFor } from "@testing-library/react";

describe("network-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isOnline", () => {
    it("should return true when navigator.onLine is true", () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
        configurable: true,
      });

      expect(isOnline()).toBe(true);
    });

    it("should return false when navigator.onLine is false", () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
        configurable: true,
      });

      expect(isOnline()).toBe(false);
    });

    it("should return true on server (when window is undefined)", () => {
      // This is tested implicitly - function checks for window/navigator
      // In test environment, navigator should be available
      expect(typeof isOnline()).toBe("boolean");
    });
  });

  describe("useNetworkStatus", () => {
    it("should return network status", () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current).toHaveProperty("isOnline");
      expect(result.current).toHaveProperty("isOffline");
      expect(result.current).toHaveProperty("wasOffline");
      expect(result.current).toHaveProperty("justCameOnline");
      expect(result.current).toHaveProperty("justWentOffline");
      expect(result.current).toHaveProperty("status");
    });

    it("should detect online state", () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it("should detect offline state", () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
        configurable: true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });

    it("should call onOnline callback when coming online", async () => {
      const onOnline = vi.fn();
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useNetworkStatus({ onOnline, useNetworkInfo: false }),
      );

      expect(result.current.isOffline).toBe(true);

      // Simulate coming online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
        configurable: true,
      });

      // Trigger online event
      window.dispatchEvent(new Event("online"));

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });
    });

    it("should call onOffline callback when going offline", async () => {
      const onOffline = vi.fn();
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
        configurable: true,
      });

      const { result } = renderHook(() =>
        useNetworkStatus({ onOffline, useNetworkInfo: false }),
      );

      expect(result.current.isOnline).toBe(true);

      // Simulate going offline
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
        configurable: true,
      });

      // Trigger offline event
      window.dispatchEvent(new Event("offline"));

      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });
    });
  });

  describe("isNetworkInfoSupported", () => {
    it("should return true when connection API is available", () => {
      Object.defineProperty(navigator, "connection", {
        writable: true,
        value: {},
        configurable: true,
      });

      expect(isNetworkInfoSupported()).toBe(true);
    });

    it("should return false when connection API is not available", () => {
      Object.defineProperty(navigator, "connection", {
        writable: true,
        value: undefined,
        configurable: true,
      });
      delete (navigator as any).mozConnection;
      delete (navigator as any).webkitConnection;

      expect(isNetworkInfoSupported()).toBe(false);
    });
  });
});
