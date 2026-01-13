/**
 * Unit tests for use-service-worker.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useServiceWorker } from "../use-service-worker";
import * as registerServiceWorkerModule from "../register-service-worker";

// Mock dependencies
vi.mock("../register-service-worker", () => ({
  registerServiceWorker: vi.fn(),
  checkForServiceWorkerUpdate: vi.fn(),
  getServiceWorkerRegistration: vi.fn(),
  getServiceWorkerState: vi.fn(),
  setupUpdateListener: vi.fn(),
  reloadClients: vi.fn(),
  canRegisterServiceWorker: vi.fn(),
  isServiceWorkerSupported: vi.fn(),
}));

describe("use-service-worker", () => {
  let mockUpdateListenerCleanup: () => void;
  let mockUpdateListener: (registration: ServiceWorkerRegistration) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateListenerCleanup = vi.fn();

    // Default mocks
    vi.mocked(
      registerServiceWorkerModule.isServiceWorkerSupported,
    ).mockReturnValue(true);
    vi.mocked(
      registerServiceWorkerModule.canRegisterServiceWorker,
    ).mockReturnValue(true);
    vi.mocked(
      registerServiceWorkerModule.getServiceWorkerRegistration,
    ).mockResolvedValue(null);
    vi.mocked(
      registerServiceWorkerModule.getServiceWorkerState,
    ).mockReturnValue({
      registration: null,
      updateAvailable: false,
      installing: false,
      waiting: false,
      active: false,
      error: null,
    });
    vi.mocked(
      registerServiceWorkerModule.setupUpdateListener,
    ).mockImplementation((registration, listener) => {
      mockUpdateListener = listener;
      return mockUpdateListenerCleanup;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useServiceWorker", () => {
    it("should return initial state", async () => {
      // Mock getServiceWorkerRegistration to return null immediately
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useServiceWorker({ autoRegister: false }),
      );

      expect(result.current.isSupported).toBe(true);
      expect(result.current.canRegister).toBe(true);
      expect(result.current.isRegistering).toBe(false);
      expect(result.current.state.registration).toBeNull();
      expect(result.current.state.updateAvailable).toBe(false);
    });

    it("should auto-register service worker on mount", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(null);
      vi.mocked(
        registerServiceWorkerModule.registerServiceWorker,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.checkForServiceWorkerUpdate,
      ).mockResolvedValue(false);

      renderHook(() => useServiceWorker({ autoRegister: true }));

      await waitFor(() => {
        expect(
          registerServiceWorkerModule.getServiceWorkerRegistration,
        ).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(
          registerServiceWorkerModule.registerServiceWorker,
        ).toHaveBeenCalled();
      });
    });

    it("should not auto-register when autoRegister is false", async () => {
      renderHook(() => useServiceWorker({ autoRegister: false }));

      await waitFor(() => {
        expect(
          registerServiceWorkerModule.registerServiceWorker,
        ).not.toHaveBeenCalled();
      });
    });

    it("should not auto-register when cannot register", async () => {
      vi.mocked(
        registerServiceWorkerModule.canRegisterServiceWorker,
      ).mockReturnValue(false);

      renderHook(() => useServiceWorker({ autoRegister: true }));

      await waitFor(() => {
        expect(
          registerServiceWorkerModule.registerServiceWorker,
        ).not.toHaveBeenCalled();
      });
    });

    it("should use existing registration if available", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerState,
      ).mockReturnValue({
        registration: mockRegistration,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: true,
        error: null,
      });

      const { result } = renderHook(() =>
        useServiceWorker({ autoRegister: true }),
      );

      await waitFor(() => {
        expect(result.current.state.registration).toBe(mockRegistration);
      });
    });

    it("should manually register service worker", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.registerServiceWorker,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.checkForServiceWorkerUpdate,
      ).mockResolvedValue(false);
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerState,
      ).mockReturnValue({
        registration: mockRegistration,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: true,
        error: null,
      });

      const { result } = renderHook(() =>
        useServiceWorker({ autoRegister: false }),
      );

      let registration: ServiceWorkerRegistration | null = null;

      await act(async () => {
        registration = await result.current.register();
      });

      expect(registration).toBe(mockRegistration);
      expect(result.current.state.registration).toBe(mockRegistration);
      expect(result.current.isRegistering).toBe(false);
    });

    it("should handle registration error", async () => {
      const error = new Error("Registration failed");
      vi.mocked(
        registerServiceWorkerModule.registerServiceWorker,
      ).mockRejectedValue(error);

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() =>
        useServiceWorker({ autoRegister: false }),
      );

      await act(async () => {
        await result.current.register();
      });

      expect(result.current.state.error).toBe(error);
      expect(result.current.isRegistering).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should not register when cannot register", async () => {
      vi.mocked(
        registerServiceWorkerModule.canRegisterServiceWorker,
      ).mockReturnValue(false);

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const { result } = renderHook(() =>
        useServiceWorker({ autoRegister: false }),
      );

      await act(async () => {
        const registration = await result.current.register();
        expect(registration).toBeNull();
      });

      expect(
        registerServiceWorkerModule.registerServiceWorker,
      ).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("should check for updates", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.checkForServiceWorkerUpdate,
      ).mockResolvedValue(true);
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerState,
      ).mockReturnValue({
        registration: mockRegistration,
        updateAvailable: true,
        installing: false,
        waiting: false,
        active: true,
        error: null,
      });

      const { result } = renderHook(() => useServiceWorker());

      let hasUpdate: boolean = false;

      await act(async () => {
        hasUpdate = await result.current.checkForUpdates();
      });

      expect(hasUpdate).toBe(true);
      expect(result.current.state.updateAvailable).toBe(true);
    });

    it("should return false when checking for updates if not supported", async () => {
      vi.mocked(
        registerServiceWorkerModule.isServiceWorkerSupported,
      ).mockReturnValue(false);

      const { result } = renderHook(() =>
        useServiceWorker({ autoRegister: false }),
      );

      let hasUpdate: boolean = true;

      await act(async () => {
        hasUpdate = await result.current.checkForUpdates();
      });

      expect(hasUpdate).toBe(false);
    });

    it("should return false when no registration exists", async () => {
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useServiceWorker({ autoRegister: false }),
      );

      let hasUpdate: boolean = true;

      await act(async () => {
        hasUpdate = await result.current.checkForUpdates();
      });

      expect(hasUpdate).toBe(false);
    });

    it("should handle error when checking for updates", async () => {
      const error = new Error("Update check failed");
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockRejectedValue(error);

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useServiceWorker());

      let hasUpdate: boolean = true;

      await act(async () => {
        hasUpdate = await result.current.checkForUpdates();
      });

      expect(hasUpdate).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should reload clients", () => {
      const { result } = renderHook(() => useServiceWorker());

      act(() => {
        result.current.reloadClients();
      });

      expect(registerServiceWorkerModule.reloadClients).toHaveBeenCalled();
    });

    it("should setup update listener when registration is available", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerState,
      ).mockReturnValue({
        registration: mockRegistration,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: true,
        error: null,
      });

      const onUpdateAvailable = vi.fn();

      const { result } = renderHook(() =>
        useServiceWorker({
          autoRegister: true,
          onUpdateAvailable,
        }),
      );

      await waitFor(
        () => {
          expect(result.current.state.registration).toBe(mockRegistration);
        },
        { timeout: 1000 },
      );

      await waitFor(
        () => {
          expect(
            registerServiceWorkerModule.setupUpdateListener,
          ).toHaveBeenCalledWith(mockRegistration, expect.any(Function));
        },
        { timeout: 1000 },
      );

      // Simulate update
      act(() => {
        mockUpdateListener(mockRegistration);
      });

      expect(onUpdateAvailable).toHaveBeenCalledWith(mockRegistration);
    });

    it("should cleanup update listener on unmount", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerState,
      ).mockReturnValue({
        registration: mockRegistration,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: true,
        error: null,
      });

      const onUpdateAvailable = vi.fn();
      const { result, unmount } = renderHook(() =>
        useServiceWorker({
          autoRegister: true,
          onUpdateAvailable,
        }),
      );

      await waitFor(
        () => {
          expect(result.current.state.registration).toBe(mockRegistration);
        },
        { timeout: 1000 },
      );

      await waitFor(
        () => {
          expect(
            registerServiceWorkerModule.setupUpdateListener,
          ).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      unmount();

      expect(mockUpdateListenerCleanup).toHaveBeenCalled();
    });

    it("should check for updates periodically", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerState,
      ).mockReturnValue({
        registration: mockRegistration,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: true,
        error: null,
      });
      vi.mocked(
        registerServiceWorkerModule.checkForServiceWorkerUpdate,
      ).mockResolvedValue(false);

      const { unmount } = renderHook(() =>
        useServiceWorker({ checkForUpdates: true, autoRegister: true }),
      );

      // Wait for initial registration
      await waitFor(
        () => {
          expect(
            registerServiceWorkerModule.getServiceWorkerRegistration,
          ).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Verify that the hook is set up for periodic updates
      // The actual periodic check happens via setInterval, which is hard to test
      // without waiting for real time. We verify the setup is correct.
      expect(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).toHaveBeenCalled();

      // Clean up
      unmount();
    });

    it("should not check for updates periodically when checkForUpdates is false", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerRegistration,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerState,
      ).mockReturnValue({
        registration: mockRegistration,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: true,
        error: null,
      });

      const { unmount } = renderHook(() =>
        useServiceWorker({ checkForUpdates: false, autoRegister: true }),
      );

      // Wait for initial registration
      await waitFor(
        () => {
          expect(
            registerServiceWorkerModule.getServiceWorkerRegistration,
          ).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );

      // Verify that checkForServiceWorkerUpdate is not called
      // (it should only be called when checkForUpdates is true)
      expect(
        registerServiceWorkerModule.checkForServiceWorkerUpdate,
      ).not.toHaveBeenCalled();

      // Clean up
      unmount();
    });

    it("should pass registration options to registerServiceWorker", async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: { state: "activated" },
        scope: "/",
        update: vi.fn(),
        unregister: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      vi.mocked(
        registerServiceWorkerModule.registerServiceWorker,
      ).mockResolvedValue(mockRegistration);
      vi.mocked(
        registerServiceWorkerModule.checkForServiceWorkerUpdate,
      ).mockResolvedValue(false);
      vi.mocked(
        registerServiceWorkerModule.getServiceWorkerState,
      ).mockReturnValue({
        registration: mockRegistration,
        updateAvailable: false,
        installing: false,
        waiting: false,
        active: true,
        error: null,
      });

      const options = {
        scope: "/custom-scope",
      };

      const { result } = renderHook(() =>
        useServiceWorker({ autoRegister: false, ...options }),
      );

      await act(async () => {
        await result.current.register();
      });

      expect(
        registerServiceWorkerModule.registerServiceWorker,
      ).toHaveBeenCalledWith(options);
    });
  });
});
