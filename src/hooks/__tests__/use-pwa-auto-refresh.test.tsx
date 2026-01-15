import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePwaAutoRefresh } from "../use-pwa-auto-refresh";

describe("usePwaAutoRefresh", () => {
  let mockMatchMedia: any;
  let mockReload: ReturnType<typeof vi.fn>;
  let originalVisibilityState: DocumentVisibilityState;
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.location.reload
    mockReload = vi.fn();
    delete (window as any).location;
    (window as any).location = { reload: mockReload };

    // Mock window.matchMedia
    mockMatchMedia = vi.fn();
    window.matchMedia = mockMatchMedia;

    // Store original visibilityState
    originalVisibilityState = document.visibilityState;

    // Mock Date.now() for consistent time tracking
    dateNowSpy = vi.spyOn(Date, "now");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: originalVisibilityState,
    });
  });

  describe("Standalone mode detection", () => {
    it("should not setup listener when not in standalone mode", () => {
      // Arrange
      mockMatchMedia.mockReturnValue({
        matches: false,
      });
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");

      // Act
      renderHook(() => usePwaAutoRefresh());

      // Assert
      expect(mockMatchMedia).toHaveBeenCalledWith("(display-mode: standalone)");
      // Only check for visibilitychange listener, ignore other listeners (e.g., from React Testing Library)
      const visibilityChangeCalls = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "visibilitychange",
      );
      expect(visibilityChangeCalls).toHaveLength(0);
    });

    it("should setup listener when in standalone mode", () => {
      // Arrange
      mockMatchMedia.mockReturnValue({
        matches: true,
      });
      const addEventListenerSpy = vi.spyOn(document, "addEventListener");

      // Act
      renderHook(() => usePwaAutoRefresh());

      // Assert
      expect(mockMatchMedia).toHaveBeenCalledWith("(display-mode: standalone)");
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function),
      );
    });
  });

  describe("Auto-refresh behavior", () => {
    beforeEach(() => {
      // Default to standalone mode for these tests
      mockMatchMedia.mockReturnValue({
        matches: true,
      });
    });

    it("should not reload when app becomes visible before timeout", () => {
      // Arrange
      const startTime = 1000000;
      dateNowSpy.mockReturnValue(startTime);

      const { unmount } = renderHook(() => usePwaAutoRefresh(60000)); // 1 minute timeout

      // Simulate app going to background
      act(() => {
        dateNowSpy.mockReturnValue(startTime + 30000); // 30 seconds later
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Simulate app becoming visible (before timeout)
      act(() => {
        dateNowSpy.mockReturnValue(startTime + 45000); // 45 seconds total (under 1 min)
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert
      expect(mockReload).not.toHaveBeenCalled();
      unmount();
    });

    it("should reload when app becomes visible after timeout", () => {
      // Arrange
      const startTime = 1000000;
      const timeoutMs = 60000; // 1 minute
      dateNowSpy.mockReturnValue(startTime);

      const { unmount } = renderHook(() => usePwaAutoRefresh(timeoutMs));

      // Simulate app going to background
      act(() => {
        dateNowSpy.mockReturnValue(startTime);
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Simulate app becoming visible (after timeout)
      act(() => {
        dateNowSpy.mockReturnValue(startTime + timeoutMs + 1000); // Over timeout
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert
      expect(mockReload).toHaveBeenCalledTimes(1);
      unmount();
    });

    it("should use default timeout of 5 minutes when not specified", () => {
      // Arrange
      const startTime = 1000000;
      const defaultTimeout = 5 * 60 * 1000; // 5 minutes
      dateNowSpy.mockReturnValue(startTime);

      const { unmount } = renderHook(() => usePwaAutoRefresh());

      // Simulate app going to background
      act(() => {
        dateNowSpy.mockReturnValue(startTime);
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Simulate app becoming visible just before default timeout
      act(() => {
        dateNowSpy.mockReturnValue(startTime + defaultTimeout - 1000);
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert - should not reload
      expect(mockReload).not.toHaveBeenCalled();

      // Simulate app becoming visible after default timeout
      act(() => {
        dateNowSpy.mockReturnValue(startTime + defaultTimeout + 1000);
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert - should reload
      expect(mockReload).toHaveBeenCalledTimes(1);
      unmount();
    });

    it("should update lastActiveRef when app goes to background", () => {
      // Arrange
      const startTime = 1000000;
      dateNowSpy.mockReturnValue(startTime);

      const { unmount } = renderHook(() => usePwaAutoRefresh(60000));

      // Act - go to background
      act(() => {
        const backgroundTime = startTime + 10000;
        dateNowSpy.mockReturnValue(backgroundTime);
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Act - become visible immediately (should not reload)
      act(() => {
        dateNowSpy.mockReturnValue(startTime + 10000 + 1000); // Just 1 second after background
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert - should not reload because only 1 second passed
      expect(mockReload).not.toHaveBeenCalled();
      unmount();
    });

    it("should not reload when app becomes visible without going to background", () => {
      // Arrange
      mockMatchMedia.mockReturnValue({
        matches: true,
      });
      const startTime = 1000000;
      dateNowSpy.mockReturnValue(startTime);

      const { unmount } = renderHook(() => usePwaAutoRefresh(60000));

      // Act - app is already visible, just fire visibilitychange as visible
      act(() => {
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert - should not reload
      expect(mockReload).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe("Cleanup", () => {
    it("should remove event listener on unmount", () => {
      // Arrange
      mockMatchMedia.mockReturnValue({
        matches: true,
      });
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      // Act
      const { unmount } = renderHook(() => usePwaAutoRefresh());
      unmount();

      // Assert
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function),
      );
    });

    it("should handle multiple unmounts gracefully", () => {
      // Arrange
      mockMatchMedia.mockReturnValue({
        matches: true,
      });

      // Act & Assert - should not throw
      const { unmount } = renderHook(() => usePwaAutoRefresh());
      unmount();
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Timeout configuration", () => {
    beforeEach(() => {
      mockMatchMedia.mockReturnValue({
        matches: true,
      });
    });

    it("should accept custom timeout value", () => {
      // Arrange
      const customTimeout = 30000; // 30 seconds
      const startTime = 1000000;
      dateNowSpy.mockReturnValue(startTime);

      const { unmount } = renderHook(() => usePwaAutoRefresh(customTimeout));

      // Simulate app going to background
      act(() => {
        dateNowSpy.mockReturnValue(startTime);
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Simulate app becoming visible after custom timeout
      act(() => {
        dateNowSpy.mockReturnValue(startTime + customTimeout + 1000);
        Object.defineProperty(document, "visibilityState", {
          writable: true,
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Assert
      expect(mockReload).toHaveBeenCalledTimes(1);
      unmount();
    });
  });
});
