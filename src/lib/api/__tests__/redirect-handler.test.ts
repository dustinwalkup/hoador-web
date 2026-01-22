import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  handleApiRedirect,
  useHandleApiRedirect,
  type ApiResponseWithRedirect,
} from "../redirect-handler";

// Mock next/navigation
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

describe("redirect-handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleApiRedirect", () => {
    it("should redirect when response has success and redirect URL", () => {
      const response: ApiResponseWithRedirect = {
        success: true,
        redirect: "/dashboard",
      };

      const result = handleApiRedirect(response, mockRouter);

      expect(result).toBe(true);
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
      expect(mockRouter.push).toHaveBeenCalledTimes(1);
    });

    it("should not redirect when response has success but no redirect URL", () => {
      const response: ApiResponseWithRedirect = {
        success: true,
      };

      const result = handleApiRedirect(response, mockRouter);

      expect(result).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("should not redirect when response is not successful", () => {
      const response: ApiResponseWithRedirect = {
        success: false,
        redirect: "/dashboard",
      };

      const result = handleApiRedirect(response, mockRouter);

      expect(result).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("should not redirect when redirect URL is empty string", () => {
      const response: ApiResponseWithRedirect = {
        success: true,
        redirect: "",
      };

      const result = handleApiRedirect(response, mockRouter);

      expect(result).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("should handle redirect to external URLs", () => {
      const response: ApiResponseWithRedirect = {
        success: true,
        redirect: "https://example.com",
      };

      const result = handleApiRedirect(response, mockRouter);

      expect(result).toBe(true);
      expect(mockRouter.push).toHaveBeenCalledWith("https://example.com");
    });

    it("should handle redirect with query parameters", () => {
      const response: ApiResponseWithRedirect = {
        success: true,
        redirect: "/dashboard?tab=settings&id=123",
      };

      const result = handleApiRedirect(response, mockRouter);

      expect(result).toBe(true);
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/dashboard?tab=settings&id=123",
      );
    });

    it("should handle response with additional properties", () => {
      const response: ApiResponseWithRedirect = {
        success: true,
        redirect: "/dashboard",
        userId: "user-123",
        message: "Welcome!",
      };

      const result = handleApiRedirect(response, mockRouter);

      expect(result).toBe(true);
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    });

    it("should handle response with error but no redirect", () => {
      const response: ApiResponseWithRedirect = {
        success: false,
        error: "Something went wrong",
      };

      const result = handleApiRedirect(response, mockRouter);

      expect(result).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe("useHandleApiRedirect", () => {
    it("should return a function that handles redirects", () => {
      const { result } = renderHook(() => useHandleApiRedirect());

      expect(typeof result.current).toBe("function");

      const response: ApiResponseWithRedirect = {
        success: true,
        redirect: "/dashboard",
      };

      const redirectResult = result.current(response);

      expect(redirectResult).toBe(true);
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    });

    it("should use the router from useRouter hook", () => {
      const { result } = renderHook(() => useHandleApiRedirect());

      const response: ApiResponseWithRedirect = {
        success: true,
        redirect: "/profile",
      };

      result.current(response);

      expect(mockRouter.push).toHaveBeenCalledWith("/profile");
    });

    it("should return false when redirect is not needed", () => {
      const { result } = renderHook(() => useHandleApiRedirect());

      const response: ApiResponseWithRedirect = {
        success: true,
      };

      const redirectResult = result.current(response);

      expect(redirectResult).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("should handle multiple redirect calls", () => {
      const { result } = renderHook(() => useHandleApiRedirect());

      const response1: ApiResponseWithRedirect = {
        success: true,
        redirect: "/dashboard",
      };

      const response2: ApiResponseWithRedirect = {
        success: true,
        redirect: "/profile",
      };

      result.current(response1);
      result.current(response2);

      expect(mockRouter.push).toHaveBeenCalledTimes(2);
      expect(mockRouter.push).toHaveBeenNthCalledWith(1, "/dashboard");
      expect(mockRouter.push).toHaveBeenNthCalledWith(2, "/profile");
    });

    it("should handle redirect with hash fragment", () => {
      const { result } = renderHook(() => useHandleApiRedirect());

      const response: ApiResponseWithRedirect = {
        success: true,
        redirect: "/dashboard#settings",
      };

      result.current(response);

      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard#settings");
    });

    it("should not redirect when success is false even with redirect URL", () => {
      const { result } = renderHook(() => useHandleApiRedirect());

      const response: ApiResponseWithRedirect = {
        success: false,
        redirect: "/dashboard",
        error: "Authentication failed",
      };

      const redirectResult = result.current(response);

      expect(redirectResult).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });
});
