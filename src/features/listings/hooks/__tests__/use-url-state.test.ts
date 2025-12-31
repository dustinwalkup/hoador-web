import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useURLState, useListingFilters } from "../use-url-state";
import type { ListingSearchFilters } from "@/dal/types";

// Mock Next.js navigation
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

const mockPathname = "/test";

let mockSearchParams: URLSearchParams;

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

describe("useURLState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  describe("Generic URL State Hook", () => {
    interface TestState extends Record<string, unknown> {
      query?: string;
      category?: string;
      sortBy?: string;
    }

    const parser = (searchParams: URLSearchParams): TestState => ({
      query: searchParams.get("q") || undefined,
      category: searchParams.get("category") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
    });

    const serializer = (state: Partial<TestState>): Record<string, string> => {
      const result: Record<string, string> = {};
      Object.entries(state).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          // Map query to q to match parser
          if (key === "query") {
            result.q = String(value);
          } else {
            result[key] = String(value);
          }
        }
      });
      return result;
    };

    it("should parse initial URL state correctly", () => {
      mockSearchParams.set("q", "test query");
      mockSearchParams.set("category", "tools");
      mockSearchParams.set("sortBy", "price");

      const { result } = renderHook(() => useURLState(parser, serializer));

      expect(result.current.state).toEqual({
        query: "test query",
        category: "tools",
        sortBy: "price",
      });
    });

    it("should return empty state when no URL parameters", () => {
      const { result } = renderHook(() => useURLState(parser, serializer));

      expect(result.current.state).toEqual({
        query: undefined,
        category: undefined,
        sortBy: undefined,
      });
    });

    it("should update URL when state changes", () => {
      const { result } = renderHook(() => useURLState(parser, serializer));

      act(() => {
        result.current.updateState({
          query: "new search",
          category: "electronics",
        });
      });

      // URLSearchParams uses + for spaces, order may vary
      const call = mockRouter.push.mock.calls[0][0];
      expect(call).toContain("q=new+search");
      expect(call).toContain("category=electronics");
    });

    it("should remove parameters when set to undefined", () => {
      mockSearchParams.set("q", "existing query");
      mockSearchParams.set("category", "existing category");

      const { result } = renderHook(() => useURLState(parser, serializer));

      act(() => {
        result.current.updateState({
          query: undefined,
          category: "new category",
        });
      });

      // URLSearchParams uses + for spaces
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/test?category=new+category",
      );
    });

    it("should not include empty strings in URL", () => {
      const { result } = renderHook(() => useURLState(parser, serializer));

      act(() => {
        result.current.updateState({
          query: "",
          category: "test",
        });
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/test?category=test");
    });

    it("should handle multiple state updates correctly", () => {
      const { result } = renderHook(() => useURLState(parser, serializer));

      act(() => {
        result.current.updateState({ query: "first" });
      });

      expect(mockRouter.push).toHaveBeenNthCalledWith(1, "/test?q=first");

      // Manually update mockSearchParams to simulate browser behavior
      mockSearchParams.set("q", "first");

      act(() => {
        result.current.updateState({ category: "second" });
      });

      // Second call should preserve q=first and add category=second
      const secondCall = mockRouter.push.mock.calls[1][0];
      expect(secondCall).toContain("q=first");
      expect(secondCall).toContain("category=second");
    });
  });

  describe("useListingFilters", () => {
    it("should parse basic filters correctly", () => {
      mockSearchParams.set("q", "power drill");
      mockSearchParams.set("category", "power-tools");
      mockSearchParams.set("minPrice", "10");
      mockSearchParams.set("maxPrice", "100");

      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state).toEqual(
        expect.objectContaining({
          query: "power drill",
          categoryId: "power-tools",
          minPrice: 10,
          maxPrice: 100,
        }),
      );
    });

    it("should parse array values (condition)", () => {
      mockSearchParams.set("condition", "good,excellent");

      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state.condition).toEqual(["good", "excellent"]);
    });

    it("should parse boolean values", () => {
      mockSearchParams.set("setup", "true");
      mockSearchParams.set("availableNow", "true");

      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state.setupAvailable).toBe(true);
      expect(result.current.state.availableNow).toBe(true);
    });

    it("should parse enum values", () => {
      mockSearchParams.set("delivery", "delivery_only");
      mockSearchParams.set("sortBy", "price");
      mockSearchParams.set("sortOrder", "asc");

      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state.deliveryMode).toBe("delivery_only");
      expect(result.current.state.sortBy).toBe("price");
      expect(result.current.state.sortOrder).toBe("asc");
    });

    it("should provide default values", () => {
      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state).toEqual({
        query: undefined,
        categoryId: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        condition: undefined,
        deliveryMode: undefined,
        setupAvailable: undefined,
        availableNow: undefined,
        sortBy: "newest",
        sortOrder: "desc",
        page: 1,
      });
    });

    it("should handle legacy parameter names", () => {
      mockSearchParams.set("deliveryMode", "both_available");
      mockSearchParams.set("setupAvailable", "true");

      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state.deliveryMode).toBe("both_available");
      expect(result.current.state.setupAvailable).toBe(true);
    });

    it("should serialize filters to URL parameters", () => {
      const { result } = renderHook(() => useListingFilters());

      const filters: Partial<ListingSearchFilters> = {
        query: "hammer",
        categoryId: "hand-tools",
        minPrice: 5,
        maxPrice: 50,
        condition: ["good", "excellent"],
        deliveryMode: "pickup_only",
        setupAvailable: true,
        availableNow: false, // Should not appear in URL
        sortBy: "price",
        sortOrder: "asc",
      };

      act(() => {
        result.current.updateState(filters);
      });

      // URLSearchParams doesn't preserve order, so check that all parameters are present
      const call = mockRouter.push.mock.calls[0][0];
      expect(call).toContain("q=hammer");
      expect(call).toContain("category=hand-tools");
      expect(call).toContain("minPrice=5");
      expect(call).toContain("maxPrice=50");
      expect(call).toContain("condition=good%2Cexcellent");
      expect(call).toContain("delivery=pickup_only");
      expect(call).toContain("setup=true");
      expect(call).toContain("sortBy=price");
      expect(call).toContain("sortOrder=asc");
    });

    it("should remove parameters when set to undefined", () => {
      mockSearchParams.set("q", "existing");
      mockSearchParams.set("category", "existing");
      mockSearchParams.set("delivery", "existing");
      mockSearchParams.set("setup", "true");

      const { result } = renderHook(() => useListingFilters());

      act(() => {
        result.current.updateState({
          query: undefined,
          categoryId: undefined,
          deliveryMode: undefined,
          setupAvailable: undefined,
          availableNow: undefined,
        });
      });

      // Should remove all parameters (defaults not included unless in URL)
      expect(mockRouter.push).toHaveBeenCalledWith("/test?");
    });

    it("should reset pagination when filters change", () => {
      mockSearchParams.set("page", "5");

      const { result } = renderHook(() => useListingFilters());

      act(() => {
        result.current.updateState({ query: "new search" });
      });

      // Should remove page parameter and add the new filter (defaults not included unless in URL)
      expect(mockRouter.push).toHaveBeenCalledWith("/test?q=new+search");
    });

    it("should not reset pagination when only page changes", () => {
      const { result } = renderHook(() => useListingFilters());

      act(() => {
        result.current.updateState({ page: 3 });
      });

      // Only page parameter is included (defaults not included unless in URL)
      expect(mockRouter.push).toHaveBeenCalledWith("/test?page=3");
    });

    it("should handle empty arrays correctly", () => {
      const { result } = renderHook(() => useListingFilters());

      act(() => {
        result.current.updateState({ condition: [] });
      });

      // Empty arrays should not appear in URL (defaults not included unless in URL)
      expect(mockRouter.push).toHaveBeenCalledWith("/test?");
    });

    it("should filter out empty strings from condition array", () => {
      mockSearchParams.set("condition", "good,,excellent,");

      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state.condition).toEqual(["good", "excellent"]);
    });

    it("should handle numeric parsing errors gracefully", () => {
      mockSearchParams.set("minPrice", "invalid");
      mockSearchParams.set("maxPrice", "not-a-number");

      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state.minPrice).toBeNaN();
      expect(result.current.state.maxPrice).toBeNaN();
    });

    it("should handle page parsing errors gracefully", () => {
      mockSearchParams.set("page", "invalid");

      const { result } = renderHook(() => useListingFilters());

      expect(result.current.state.page).toBeNaN();
    });

    it("should preserve existing parameters when updating", () => {
      mockSearchParams.set("q", "existing query");
      mockSearchParams.set("sortBy", "rating");

      const { result } = renderHook(() => useListingFilters());

      act(() => {
        result.current.updateState({ categoryId: "new-category" });
      });

      // Should preserve existing parameters and add new one (defaults not included unless in URL)
      expect(mockRouter.push).toHaveBeenCalledWith(
        "/test?q=existing+query&sortBy=rating&category=new-category",
      );
    });
  });
});
