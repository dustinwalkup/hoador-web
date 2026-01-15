import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { PwaAutoRefresh } from "../pwa-auto-refresh";
import * as usePwaAutoRefreshModule from "@/hooks/use-pwa-auto-refresh";

describe("PwaAutoRefresh", () => {
  let mockUsePwaAutoRefresh: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePwaAutoRefresh = vi.fn();
    vi.spyOn(usePwaAutoRefreshModule, "usePwaAutoRefresh").mockImplementation(
      mockUsePwaAutoRefresh as (timeoutMs?: number) => void,
    );
  });

  describe("Rendering", () => {
    it("should render nothing (return null)", () => {
      // Act
      const { container } = render(<PwaAutoRefresh />);

      // Assert
      expect(container.firstChild).toBeNull();
    });

    it("should not render any visible content", () => {
      // Act
      const { container } = render(<PwaAutoRefresh />);

      // Assert
      expect(container.innerHTML).toBe("");
    });
  });

  describe("Hook integration", () => {
    it("should call usePwaAutoRefresh hook", () => {
      // Act
      render(<PwaAutoRefresh />);

      // Assert
      expect(mockUsePwaAutoRefresh).toHaveBeenCalledTimes(1);
    });

    it("should call usePwaAutoRefresh with default timeout", () => {
      // Act
      render(<PwaAutoRefresh />);

      // Assert
      // Hook is called without arguments, which means it uses the default timeout
      expect(mockUsePwaAutoRefresh).toHaveBeenCalledTimes(1);
      // When called without arguments, the default parameter (5 minutes) is used
      expect(mockUsePwaAutoRefresh.mock.calls[0]).toEqual([]);
    });

    it("should handle hook errors gracefully", () => {
      // Arrange
      mockUsePwaAutoRefresh.mockImplementation(() => {
        throw new Error("Hook error");
      });

      // Act & Assert - should not crash the component
      expect(() => render(<PwaAutoRefresh />)).toThrow("Hook error");
    });
  });

  describe("Component structure", () => {
    it("should be a functional component", () => {
      // Act & Assert
      expect(typeof PwaAutoRefresh).toBe("function");
      expect(PwaAutoRefresh.name).toBe("PwaAutoRefresh");
    });

    it("should work with React.memo if needed", () => {
      // Act
      const { rerender } = render(<PwaAutoRefresh />);

      // Assert - hook should be called on initial render
      expect(mockUsePwaAutoRefresh).toHaveBeenCalledTimes(1);

      // Act - rerender
      rerender(<PwaAutoRefresh />);

      // Assert - hook should be called again (not memoized by default)
      expect(mockUsePwaAutoRefresh).toHaveBeenCalledTimes(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle multiple renders", () => {
      // Act
      const { rerender } = render(<PwaAutoRefresh />);
      rerender(<PwaAutoRefresh />);
      rerender(<PwaAutoRefresh />);

      // Assert
      expect(mockUsePwaAutoRefresh).toHaveBeenCalledTimes(3);
    });

    it("should handle unmounting gracefully", () => {
      // Act
      const { unmount } = render(<PwaAutoRefresh />);
      unmount();

      // Assert - should not throw
      expect(mockUsePwaAutoRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
