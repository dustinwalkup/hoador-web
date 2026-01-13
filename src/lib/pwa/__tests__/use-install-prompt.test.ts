/**
 * Unit tests for use-install-prompt.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useInstallPrompt } from "../use-install-prompt";
import * as installPromptModule from "../install-prompt";
import type { InstallPromptState } from "../types";

// Mock dependencies
vi.mock("../install-prompt", () => ({
  initializeInstallPrompt: vi.fn(),
  showInstallPrompt: vi.fn(),
  isAppInstalled: vi.fn(),
  isInstallPromptDismissed: vi.fn(),
  dismissInstallPrompt: vi.fn(),
  clearDismissedStatus: vi.fn(),
  subscribeToInstallPromptState: vi.fn(),
  isInstallPromptSupported: vi.fn(),
}));

describe("use-install-prompt", () => {
  let mockUnsubscribe: () => void;
  let mockStateListener: (state: InstallPromptState) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe = vi.fn();
    mockStateListener = vi.fn();

    // Default mocks
    vi.mocked(installPromptModule.isAppInstalled).mockReturnValue(false);
    vi.mocked(installPromptModule.isInstallPromptDismissed).mockReturnValue(
      false,
    );
    vi.mocked(installPromptModule.isInstallPromptSupported).mockReturnValue(
      true,
    );
    vi.mocked(
      installPromptModule.subscribeToInstallPromptState,
    ).mockImplementation((listener) => {
      mockStateListener = listener;
      // Call listener immediately with initial state
      listener({
        deferredPrompt: null,
        isInstallable: false,
        isInstalled: false,
        userChoice: null,
      });
      return mockUnsubscribe;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useInstallPrompt", () => {
    it("should initialize install prompt on mount", () => {
      renderHook(() => useInstallPrompt());

      expect(installPromptModule.initializeInstallPrompt).toHaveBeenCalled();
      expect(
        installPromptModule.subscribeToInstallPromptState,
      ).toHaveBeenCalled();
    });

    it("should return initial state", () => {
      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isSupported).toBe(true);
      expect(result.current.isInstalled).toBe(false);
      expect(result.current.isInstallable).toBe(false);
      expect(result.current.isDismissed).toBe(false);
      expect(result.current.isInstalling).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should update state when installable", () => {
      const { result } = renderHook(() => useInstallPrompt());

      act(() => {
        mockStateListener({
          deferredPrompt: {} as any,
          isInstallable: true,
          isInstalled: false,
          userChoice: null,
        });
      });

      expect(result.current.isInstallable).toBe(true);
      expect(result.current.isInstalled).toBe(false);
    });

    it("should update state when installed", () => {
      const { result } = renderHook(() => useInstallPrompt());

      act(() => {
        mockStateListener({
          deferredPrompt: null,
          isInstallable: false,
          isInstalled: true,
          userChoice: "accepted",
        });
      });

      expect(result.current.isInstalled).toBe(true);
      expect(result.current.isInstallable).toBe(false);
    });

    it("should update dismissed status", () => {
      vi.mocked(installPromptModule.isInstallPromptDismissed).mockReturnValue(
        true,
      );

      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isDismissed).toBe(true);
    });

    it("should show prompt successfully", async () => {
      vi.mocked(installPromptModule.showInstallPrompt).mockResolvedValue({
        outcome: "accepted",
        platform: "android",
      });

      const { result } = renderHook(() => useInstallPrompt());

      // Set installable state
      act(() => {
        mockStateListener({
          deferredPrompt: {} as any,
          isInstallable: true,
          isInstalled: false,
          userChoice: null,
        });
      });

      let promptResult: { outcome: string; platform: string } | undefined;

      await act(async () => {
        promptResult = await result.current.showPrompt();
      });

      expect(installPromptModule.showInstallPrompt).toHaveBeenCalled();
      expect(promptResult).toEqual({
        outcome: "accepted",
        platform: "android",
      });
      expect(result.current.isInstalling).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should handle prompt error", async () => {
      const error = new Error("Failed to show prompt");
      vi.mocked(installPromptModule.showInstallPrompt).mockRejectedValue(error);

      const { result } = renderHook(() => useInstallPrompt());

      // Set installable state
      act(() => {
        mockStateListener({
          deferredPrompt: {} as any,
          isInstallable: true,
          isInstalled: false,
          userChoice: null,
        });
      });

      await act(async () => {
        try {
          await result.current.showPrompt();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe(error);
      expect(result.current.isInstalling).toBe(false);
    });

    it("should not show prompt if not installable", async () => {
      const { result } = renderHook(() => useInstallPrompt());

      await act(async () => {
        const promptResult = await result.current.showPrompt();
        expect(promptResult).toEqual({
          outcome: "dismissed",
          platform: "unknown",
        });
      });

      expect(installPromptModule.showInstallPrompt).not.toHaveBeenCalled();
    });

    it("should not show prompt if already installed", async () => {
      vi.mocked(installPromptModule.isAppInstalled).mockReturnValue(true);

      const { result } = renderHook(() => useInstallPrompt());

      act(() => {
        mockStateListener({
          deferredPrompt: null,
          isInstallable: false,
          isInstalled: true,
          userChoice: null,
        });
      });

      await act(async () => {
        const promptResult = await result.current.showPrompt();
        expect(promptResult).toEqual({
          outcome: "dismissed",
          platform: "unknown",
        });
      });

      expect(installPromptModule.showInstallPrompt).not.toHaveBeenCalled();
    });

    it("should set isInstalling during prompt", async () => {
      let resolvePrompt: (value: any) => void;
      const promptPromise = new Promise((resolve) => {
        resolvePrompt = resolve;
      });

      vi.mocked(installPromptModule.showInstallPrompt).mockReturnValue(
        promptPromise as any,
      );

      const { result } = renderHook(() => useInstallPrompt());

      act(() => {
        mockStateListener({
          deferredPrompt: {} as any,
          isInstallable: true,
          isInstalled: false,
          userChoice: null,
        });
      });

      act(() => {
        result.current.showPrompt();
      });

      expect(result.current.isInstalling).toBe(true);

      await act(async () => {
        resolvePrompt!({ outcome: "accepted", platform: "android" });
        await promptPromise;
      });

      await waitFor(() => {
        expect(result.current.isInstalling).toBe(false);
      });
    });

    it("should dismiss prompt", () => {
      const { result } = renderHook(() => useInstallPrompt());

      act(() => {
        result.current.dismiss();
      });

      expect(installPromptModule.dismissInstallPrompt).toHaveBeenCalled();
      expect(result.current.isDismissed).toBe(true);
    });

    it("should clear dismissed status", () => {
      vi.mocked(installPromptModule.isInstallPromptDismissed).mockReturnValue(
        true,
      );

      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isDismissed).toBe(true);

      act(() => {
        result.current.clearDismissed();
      });

      expect(installPromptModule.clearDismissedStatus).toHaveBeenCalled();
      expect(result.current.isDismissed).toBe(false);
    });

    it("should cleanup subscription on unmount", () => {
      const { unmount } = renderHook(() => useInstallPrompt());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("should handle unsupported browser", () => {
      vi.mocked(installPromptModule.isInstallPromptSupported).mockReturnValue(
        false,
      );

      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isSupported).toBe(false);
    });

    it("should update dismissed status when state changes", () => {
      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isDismissed).toBe(false);

      vi.mocked(installPromptModule.isInstallPromptDismissed).mockReturnValue(
        true,
      );

      act(() => {
        mockStateListener({
          deferredPrompt: null,
          isInstallable: false,
          isInstalled: false,
          userChoice: null,
        });
      });

      expect(result.current.isDismissed).toBe(true);
    });
  });
});
