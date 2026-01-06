import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExplorePageClient } from "../explore-page-client";

// Mock all dependencies
vi.mock("@/features/listings/hooks/use-url-state", () => ({
  useListingFilters: vi.fn(),
}));

vi.mock("@/features/listings/hooks/use-listings", () => ({
  useSearchListings: vi.fn(),
}));

vi.mock("@/hooks/use-infinite-scroll", () => ({
  useInfiniteScroll: vi.fn(),
}));

vi.mock("@/components/dashboard/listing-card-skeleton", () => ({
  ListingCardSkeleton: vi.fn(() => <div data-testid="listing-card-skeleton" />),
}));

vi.mock(
  "@/features/listings/components/explore-page/explore-page-filters",
  () => ({
    ExplorePageFilters: vi.fn(() => <div data-testid="explore-page-filters" />),
  }),
);

vi.mock(
  "@/features/listings/components/explore-page/explore-page-content",
  () => ({
    ExplorePageContent: vi.fn(() => <div data-testid="explore-page-content" />),
  }),
);

import { useListingFilters } from "@/features/listings/hooks/use-url-state";
import { useSearchListings } from "@/features/listings/hooks/use-listings";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ExplorePageFilters } from "@/features/listings/components/explore-page/explore-page-filters";
import { ExplorePageContent } from "@/features/listings/components/explore-page/explore-page-content";

describe("ExplorePageClient", () => {
  const mockFilters = {
    query: "",
    categoryId: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    condition: [],
    deliveryMode: "pickup_only",
    setupAvailable: undefined,
    availableNow: undefined,
    sortBy: "newest",
    sortOrder: "desc",
    page: 1,
  };

  const mockListings = [
    { id: "1", name: "Drill 1" },
    { id: "2", name: "Hammer 1" },
  ];

  const mockQueryData = {
    pages: [
      { data: [{ id: "1", name: "Drill 1" }] },
      { data: [{ id: "2", name: "Hammer 1" }] },
    ],
  };

  const mockUseListingFilters = {
    state: mockFilters,
  };

  const mockUseSearchListings = {
    data: mockQueryData,
    fetchNextPage: vi.fn(),
    hasNextPage: true,
    isLoading: false,
    isFetchingNextPage: false,
    isRefetching: false,
    isPending: false,
    error: null,
  };

  const mockUseInfiniteScroll = vi.fn();

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.clearAllMocks();

    (useListingFilters as any).mockReturnValue(mockUseListingFilters);
    (useSearchListings as any).mockReturnValue(mockUseSearchListings);
    (useInfiniteScroll as any).mockReturnValue(mockUseInfiniteScroll);
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  describe("Component Integration", () => {
    it("should render ExplorePageFilters and ExplorePageContent", () => {
      renderWithQueryClient(<ExplorePageClient />);

      expect(screen.getByTestId("explore-page-filters")).toBeInTheDocument();
      expect(screen.getByTestId("explore-page-content")).toBeInTheDocument();
    });

    it("should pass userId to useSearchListings hook", () => {
      renderWithQueryClient(<ExplorePageClient userId="user-123" />);

      expect(useSearchListings).toHaveBeenCalledWith(mockFilters, "user-123");
    });

    it("should pass filters from useListingFilters to useSearchListings", () => {
      renderWithQueryClient(<ExplorePageClient />);

      expect(useSearchListings).toHaveBeenCalledWith(mockFilters, undefined);
    });

    it("should call useInfiniteScroll with correct parameters", () => {
      renderWithQueryClient(<ExplorePageClient />);

      expect(useInfiniteScroll).toHaveBeenCalledWith({
        onLoadMore: mockUseSearchListings.fetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        threshold: 500,
      });
    });
  });

  describe("Data Processing", () => {
    it("should flatten and deduplicate listings data", () => {
      const duplicateData = {
        pages: [
          { data: [{ id: "1", name: "Drill 1" }] },
          {
            data: [
              { id: "1", name: "Drill 1 Duplicate" },
              { id: "2", name: "Hammer 1" },
            ],
          },
        ],
      };

      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        data: duplicateData,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(ExplorePageContent).toHaveBeenCalledWith(
        expect.objectContaining({
          listings: [
            { id: "1", name: "Drill 1" },
            { id: "2", name: "Hammer 1" },
          ],
        }),
        undefined,
      );
    });

    it("should handle empty data gracefully", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        data: null,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(ExplorePageContent).toHaveBeenCalledWith(
        expect.objectContaining({
          listings: [],
        }),
        undefined,
      );
    });

    it("should handle pages with null/undefined data", () => {
      const dataWithNulls = {
        pages: [
          { data: [{ id: "1", name: "Drill 1" }] },
          { data: null },
          { data: [{ id: "2", name: "Hammer 1" }] },
        ],
      };

      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        data: dataWithNulls,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(ExplorePageContent).toHaveBeenCalledWith(
        expect.objectContaining({
          listings: [
            { id: "1", name: "Drill 1" },
            { id: "2", name: "Hammer 1" },
          ],
        }),
        undefined,
      );
    });

    it("should filter out listings without IDs", () => {
      const dataWithInvalidListings = {
        pages: [{ data: [{ id: "1", name: "Valid" }, { name: "Invalid" }] }],
      };

      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        data: dataWithInvalidListings,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(ExplorePageContent).toHaveBeenCalledWith(
        expect.objectContaining({
          listings: [{ id: "1", name: "Valid" }],
        }),
        undefined,
      );
    });
  });

  describe("Loading States", () => {
    it("should show loading skeleton when isLoading is true", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        isLoading: true,
        data: null,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(screen.getAllByTestId("listing-card-skeleton")).toHaveLength(8);
      expect(
        screen.queryByTestId("explore-page-content"),
      ).not.toBeInTheDocument();
    });

    it("should show loading skeleton when isPending and no data", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        isPending: true,
        data: null,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(screen.getAllByTestId("listing-card-skeleton")).toHaveLength(8);
      expect(
        screen.queryByTestId("explore-page-content"),
      ).not.toBeInTheDocument();
    });

    it("should show refetching indicator when isRefetching is true", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        isRefetching: true,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(screen.getByText("Updating results...")).toBeInTheDocument();
    });

    it("should not show loading skeleton when data exists and isPending", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        isPending: true,
        data: mockQueryData,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(
        screen.queryByTestId("listing-card-skeleton"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("explore-page-content")).toBeInTheDocument();
    });
  });

  describe("Error States", () => {
    it("should render error state when error exists", () => {
      const mockError = new Error("Network error occurred");

      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        error: mockError,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(screen.getByText("⚠️")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Failed to load listings" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Network error occurred")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Try Again" }),
      ).toBeInTheDocument();
    });

    it("should reload page when Try Again button is clicked", async () => {
      const mockError = new Error("Network error");
      const mockReload = vi.fn();
      Object.defineProperty(window, "location", {
        value: { reload: mockReload },
        writable: true,
      });

      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        error: mockError,
      });

      renderWithQueryClient(<ExplorePageClient />);

      const tryAgainButton = screen.getByRole("button", { name: "Try Again" });
      fireEvent.click(tryAgainButton);

      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe("Infinite Scroll", () => {
    it("should render infinite scroll trigger when hasNextPage is true", () => {
      renderWithQueryClient(<ExplorePageClient />);

      expect(screen.getByText("Scroll to load more...")).toBeInTheDocument();
    });

    it("should render loading spinner when isFetchingNextPage is true", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        isFetchingNextPage: true,
      });

      const { container: renderContainer } = renderWithQueryClient(
        <ExplorePageClient />,
      );

      // The Loader2 icon is rendered when fetching next page
      expect(
        renderContainer.querySelector(".animate-spin"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Scroll to load more..."),
      ).not.toBeInTheDocument();
    });

    it("should not render infinite scroll trigger when hasNextPage is false", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        hasNextPage: false,
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(
        screen.queryByText("Scroll to load more..."),
      ).not.toBeInTheDocument();
    });

    it("should pass loadMoreRef to infinite scroll trigger div", () => {
      renderWithQueryClient(<ExplorePageClient />);

      // The infinite scroll hook is called
      expect(useInfiniteScroll).toHaveBeenCalled();
      // The trigger div exists
      const triggerDiv = screen.getByText(
        "Scroll to load more...",
      ).parentElement;
      expect(triggerDiv).toBeInTheDocument();
    });
  });

  describe("Props and Configuration", () => {
    it("should pass correct props to ExplorePageFilters", () => {
      renderWithQueryClient(<ExplorePageClient />);

      expect(ExplorePageFilters).toHaveBeenCalledWith({}, undefined);
    });

    it("should pass correct props to ExplorePageContent", () => {
      renderWithQueryClient(<ExplorePageClient />);

      expect(ExplorePageContent).toHaveBeenCalledWith(
        expect.objectContaining({
          listings: mockListings,
        }),
        undefined,
      );
    });

    it("should pass listings to ExplorePageContent", () => {
      renderWithQueryClient(<ExplorePageClient />);

      expect(ExplorePageContent).toHaveBeenCalledWith(
        expect.objectContaining({
          listings: expect.any(Array),
        }),
        undefined,
      );
    });
  });

  describe("Styling and Layout", () => {
    it("should have correct container styling", () => {
      const { container } = renderWithQueryClient(<ExplorePageClient />);

      const mainContainer = container.querySelector(".space-y-6");
      expect(mainContainer).toBeInTheDocument();
    });

    it("should have correct loading skeleton grid", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        isLoading: true,
        data: null,
      });

      const { container } = renderWithQueryClient(<ExplorePageClient />);

      const grid = container.querySelector(
        'div[class*="grid"][class*="gap-6"]',
      );
      expect(grid).toBeInTheDocument();
    });

    it("should have correct error state styling", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        error: new Error("Test error"),
      });

      const { container } = renderWithQueryClient(<ExplorePageClient />);

      const errorContainer = container.querySelector(
        ".flex.flex-col.items-center",
      );
      expect(errorContainer).toBeInTheDocument();
    });

    it("should have correct refetching indicator styling", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        isRefetching: true,
      });

      renderWithQueryClient(<ExplorePageClient />);

      const indicator = screen.getByText("Updating results...").parentElement
        ?.parentElement;
      expect(indicator).toHaveClass(
        "absolute -top-2 right-0 left-0 z-10 flex justify-center",
      );
    });
  });

  describe("Performance and Optimization", () => {
    it("should memoize flattened listings data", () => {
      renderWithQueryClient(<ExplorePageClient />);

      // The component should re-render when data changes
      expect(ExplorePageContent).toHaveBeenCalledTimes(1);

      // Trigger re-render by changing data
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        data: {
          pages: [{ data: [{ id: "3", name: "New Listing" }] }],
        },
      });

      // Force re-render
      renderWithQueryClient(<ExplorePageClient />);

      expect(ExplorePageContent).toHaveBeenCalledTimes(2);
    });

    it("should handle rapid filter changes gracefully", () => {
      // Test that component doesn't break with rapid state changes
      const changingFilters = { ...mockFilters, query: "changing" };

      (useListingFilters as any).mockReturnValue({
        state: changingFilters,
      });

      expect(() => renderWithQueryClient(<ExplorePageClient />)).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible error message", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        error: new Error("Test error"),
      });

      renderWithQueryClient(<ExplorePageClient />);

      expect(
        screen.getByRole("heading", { name: "Failed to load listings" }),
      ).toBeInTheDocument();
    });

    it("should have accessible loading indicator", () => {
      (useSearchListings as any).mockReturnValue({
        ...mockUseSearchListings,
        isRefetching: true,
      });

      renderWithQueryClient(<ExplorePageClient />);

      // The "Updating results..." text serves as the accessible indicator
      expect(screen.getByText("Updating results...")).toBeInTheDocument();
    });
  });
});
