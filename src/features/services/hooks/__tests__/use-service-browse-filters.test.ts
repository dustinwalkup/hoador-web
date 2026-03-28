import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServiceBrowseFilters } from "../use-service-browse-filters";

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

const mockPathname = "/dashboard/services";

let mockSearchParams: URLSearchParams;

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

describe("useServiceBrowseFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  // ─── Parsing ────────────────────────────────────────────────────────────────

  describe("state parsing", () => {
    it("returns default state when no URL params are set", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state).toEqual({
        query: undefined,
        categoryId: undefined,
        minPrice: "",
        maxPrice: "",
        pricingTypes: [],
        sortBy: "newest",
      });
    });

    it("parses q param into query", () => {
      mockSearchParams.set("q", "lawn mowing");

      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state.query).toBe("lawn mowing");
    });

    it("parses category param into categoryId", () => {
      mockSearchParams.set("category", "abc-123");

      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state.categoryId).toBe("abc-123");
    });

    it("parses minPrice and maxPrice as strings", () => {
      mockSearchParams.set("minPrice", "25");
      mockSearchParams.set("maxPrice", "150");

      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state.minPrice).toBe("25");
      expect(result.current.state.maxPrice).toBe("150");
    });

    it("parses a single pricingType value", () => {
      mockSearchParams.set("pricingType", "hourly");

      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state.pricingTypes).toEqual(["hourly"]);
    });

    it("parses multiple pricingType values from comma-separated string", () => {
      mockSearchParams.set("pricingType", "hourly,fixed");

      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state.pricingTypes).toEqual(["hourly", "fixed"]);
    });

    it("filters empty strings from pricingType param", () => {
      mockSearchParams.set("pricingType", "hourly,,fixed,");

      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state.pricingTypes).toEqual(["hourly", "fixed"]);
    });

    it("parses sort param into sortBy", () => {
      mockSearchParams.set("sort", "price_asc");

      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state.sortBy).toBe("price_asc");
    });

    it("defaults sortBy to newest when sort param is absent", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state.sortBy).toBe("newest");
    });

    it("parses all params simultaneously", () => {
      mockSearchParams.set("q", "cleaning");
      mockSearchParams.set("category", "cat-99");
      mockSearchParams.set("minPrice", "10");
      mockSearchParams.set("maxPrice", "200");
      mockSearchParams.set("pricingType", "fixed");
      mockSearchParams.set("sort", "rating_desc");

      const { result } = renderHook(() => useServiceBrowseFilters());

      expect(result.current.state).toEqual({
        query: "cleaning",
        categoryId: "cat-99",
        minPrice: "10",
        maxPrice: "200",
        pricingTypes: ["fixed"],
        sortBy: "rating_desc",
      });
    });
  });

  // ─── updateState ────────────────────────────────────────────────────────────

  describe("updateState", () => {
    it("sets q param when query is provided", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ query: "handyman" });
      });

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining("q=handyman"),
      );
    });

    it("removes q param when query is undefined", () => {
      mockSearchParams.set("q", "old query");

      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ query: undefined });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url).not.toContain("q=");
    });

    it("sets category param when categoryId is provided", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ categoryId: "xyz-456" });
      });

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining("category=xyz-456"),
      );
    });

    it("removes category param when categoryId is undefined", () => {
      mockSearchParams.set("category", "xyz-456");

      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ categoryId: undefined });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url).not.toContain("category=");
    });

    it("sets minPrice param when minPrice is non-empty", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ minPrice: "50" });
      });

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining("minPrice=50"),
      );
    });

    it("removes minPrice param when minPrice is empty string", () => {
      mockSearchParams.set("minPrice", "50");

      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ minPrice: "" });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url).not.toContain("minPrice=");
    });

    it("sets maxPrice param when maxPrice is non-empty", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ maxPrice: "300" });
      });

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining("maxPrice=300"),
      );
    });

    it("removes maxPrice param when maxPrice is empty string", () => {
      mockSearchParams.set("maxPrice", "300");

      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ maxPrice: "" });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url).not.toContain("maxPrice=");
    });

    it("sets pricingType param as comma-separated values", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ pricingTypes: ["hourly", "fixed"] });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url).toContain("pricingType=hourly%2Cfixed");
    });

    it("removes pricingType param when array is empty", () => {
      mockSearchParams.set("pricingType", "hourly");

      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ pricingTypes: [] });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url).not.toContain("pricingType=");
    });

    it("sets sort param when sortBy is not newest", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ sortBy: "price_desc" });
      });

      expect(mockRouter.push).toHaveBeenCalledWith(
        expect.stringContaining("sort=price_desc"),
      );
    });

    it("removes sort param when sortBy is newest (default)", () => {
      mockSearchParams.set("sort", "price_asc");

      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ sortBy: "newest" });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url).not.toContain("sort=");
    });

    it("preserves unrelated params when doing a targeted update", () => {
      mockSearchParams.set("q", "pet sitting");
      mockSearchParams.set("sort", "rating_desc");

      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ categoryId: "cat-111" });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url).toContain("q=pet+sitting");
      expect(url).toContain("sort=rating_desc");
      expect(url).toContain("category=cat-111");
    });

    it("clears all params when full reset is applied", () => {
      mockSearchParams.set("q", "tutoring");
      mockSearchParams.set("category", "cat-222");
      mockSearchParams.set("minPrice", "20");
      mockSearchParams.set("maxPrice", "100");
      mockSearchParams.set("pricingType", "hourly");
      mockSearchParams.set("sort", "price_asc");

      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({
          query: undefined,
          categoryId: undefined,
          minPrice: "",
          maxPrice: "",
          pricingTypes: [],
          sortBy: "newest",
        });
      });

      expect(mockRouter.push).toHaveBeenCalledWith(`${mockPathname}?`);
    });

    it("pushes to the correct pathname", () => {
      const { result } = renderHook(() => useServiceBrowseFilters());

      act(() => {
        result.current.updateState({ query: "errands" });
      });

      const url = mockRouter.push.mock.calls[0][0] as string;
      expect(url.startsWith(mockPathname)).toBe(true);
    });
  });
});
