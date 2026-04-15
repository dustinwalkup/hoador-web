import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActiveListings } from "../active-listings";

// Mock all dependencies
vi.mock("@/features/listings/hooks/use-garage", () => ({
  useActiveListings: vi.fn(),
}));

vi.mock("@/components/dashboard/rental-card", () => ({
  default: vi.fn(
    ({
      id,
      name,
      imageUrl,
      status,
      price,
      availability,
      cardType,
      listingData,
    }) => (
      <div data-testid={`rental-card-${id}`}>
        <div data-testid="card-name">{name}</div>
        <div data-testid="card-image">{imageUrl}</div>
        <div data-testid="card-status">{status}</div>
        <div data-testid="card-price">{price}</div>
        <div data-testid="card-availability">{availability}</div>
        <div data-testid="card-type">{cardType}</div>
        <div data-testid="card-listing-id">{listingData.id}</div>
        <div data-testid="card-listing-name">{listingData.name}</div>
        <div data-testid="card-listing-status">{listingData.status}</div>
        <div data-testid="card-is-active">
          {listingData.isActive ? "active" : "inactive"}
        </div>
      </div>
    ),
  ),
}));

vi.mock(
  "@/features/listings/components/garage-page/garage-loading-skeleton",
  () => ({
    GarageLoadingSkeleton: vi.fn(() => <div data-testid="loading-skeleton" />),
  }),
);

vi.mock("@/features/listings/components/garage-page/garage-error", () => ({
  GarageError: vi.fn(({ error, onRetry }) => (
    <div data-testid="error-component">
      <div>{error.message}</div>
      <button onClick={onRetry}>Retry</button>
    </div>
  )),
}));

import { useActiveListings } from "@/features/listings/hooks/use-garage";

describe("ActiveListings", () => {
  const mockFilters = {
    query: "",
    categoryId: undefined,
    sortBy: "newest" as const,
    sortOrder: "desc" as const,
    rentalStatus: undefined,
  };

  const mockListings = [
    {
      id: "listing-1",
      name: "Power Drill",
      dailyRate: 15.99,
      firstImageUrl: "https://example.com/drill.jpg",
      status: "available",
      isActive: true,
    },
    {
      id: "listing-2",
      name: "Hammer",
      dailyRate: 5.99,
      firstImageUrl: "https://example.com/hammer.jpg",
      status: "rented",
      isActive: true,
    },
  ];

  const mockUseActiveListings = {
    data: mockListings,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.clearAllMocks();
    (useActiveListings as any).mockReturnValue(mockUseActiveListings);
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>,
    );
  };

  describe("Component Rendering", () => {
    it("should render without crashing", () => {
      expect(() =>
        renderWithQueryClient(<ActiveListings filters={mockFilters} />),
      ).not.toThrow();
    });

    it("should render grid container", () => {
      const { container } = renderWithQueryClient(
        <ActiveListings filters={mockFilters} />,
      );

      const grid = container.querySelector('div[class*="grid"]');
      expect(grid).toHaveClass("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ");
    });

    it("should render rental cards for each listing", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getByTestId("rental-card-listing-1")).toBeInTheDocument();
      expect(screen.getByTestId("rental-card-listing-2")).toBeInTheDocument();
    });

    it("should render add new listing card", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getByText("List another item")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Share your tools with neighbors and earn extra income",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /List an item/ }),
      ).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should render loading skeleton when isLoading is true", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        isLoading: true,
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      // Check that loading skeleton is rendered (mocked component uses data-testid)
      expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
      expect(
        screen.queryByTestId("rental-card-listing-1"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Error States", () => {
    it("should render error component when error exists", () => {
      const mockError = new Error("Failed to load listings");
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        error: mockError,
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      // Error component mock renders the message in a div, not a heading
      expect(screen.getByText("Failed to load listings")).toBeInTheDocument();
      expect(screen.getByTestId("error-component")).toBeInTheDocument();
    });

    it("should call refetch when retry button is clicked", () => {
      const mockError = new Error("Network error");
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        error: mockError,
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      const retryButton = screen.getByRole("button", { name: "Retry" });
      retryButton.click();

      expect(mockUseActiveListings.refetch).toHaveBeenCalled();
    });
  });

  describe("Empty States", () => {
    it("should render empty state when no listings", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: [],
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(
        screen.getByText("Start earning from things you already own"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Most listings take under 2 minutes to set up"),
      ).toBeInTheDocument();
      const listItemLinks = screen.getAllByRole("link", {
        name: /List an item/i,
      });
      expect(listItemLinks.length).toBeGreaterThanOrEqual(1);
      listItemLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/dashboard/listings/add");
      });
    });

    it("should render filtered empty state when filters are applied", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: [],
      });

      const filtersWithQuery = { ...mockFilters, query: "drill" };

      renderWithQueryClient(<ActiveListings filters={filtersWithQuery} />);

      expect(
        screen.getByText("No listings found matching your search criteria"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Try adjusting your search or filters"),
      ).toBeInTheDocument();
    });

    it("should render filtered empty state when category filter is applied", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: [],
      });

      const filtersWithCategory = { ...mockFilters, categoryId: "power-tools" };

      renderWithQueryClient(<ActiveListings filters={filtersWithCategory} />);

      expect(
        screen.getByText("No listings found matching your search criteria"),
      ).toBeInTheDocument();
    });

    it("should render filtered empty state when rental status filter is applied", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: [],
      });

      const filtersWithStatus = {
        ...mockFilters,
        rentalStatus: "available" as const,
      };

      renderWithQueryClient(<ActiveListings filters={filtersWithStatus} />);

      expect(
        screen.getByText("No listings found matching your search criteria"),
      ).toBeInTheDocument();
    });

    it("should still render add new listing card in empty state", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: [],
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getByText("List another item")).toBeInTheDocument();
      expect(
        screen.getAllByRole("link", { name: /List an item/ }),
      ).toHaveLength(2);
    });
  });

  describe("RentalCard Props", () => {
    it("should pass correct props to RentalCard", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      // Get first listing card
      const firstCard = screen.getByTestId("rental-card-listing-1");

      // Check first listing props
      expect(within(firstCard).getByTestId("card-name")).toHaveTextContent(
        "Power Drill",
      );
      expect(within(firstCard).getByTestId("card-image")).toHaveTextContent(
        "https://example.com/drill.jpg",
      );
      expect(within(firstCard).getByTestId("card-status")).toHaveTextContent(
        "listed",
      );
      expect(within(firstCard).getByTestId("card-price")).toHaveTextContent(
        "$15.99/day",
      );
      expect(
        within(firstCard).getByTestId("card-availability"),
      ).toHaveTextContent("Available");
      expect(within(firstCard).getByTestId("card-type")).toHaveTextContent(
        "listings",
      );

      // Check listing data
      expect(
        within(firstCard).getByTestId("card-listing-id"),
      ).toHaveTextContent("listing-1");
      expect(
        within(firstCard).getByTestId("card-listing-name"),
      ).toHaveTextContent("Power Drill");
      expect(
        within(firstCard).getByTestId("card-listing-status"),
      ).toHaveTextContent("available");
      expect(within(firstCard).getByTestId("card-is-active")).toHaveTextContent(
        "active",
      );
    });

    it("should convert status correctly", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      // First listing (available) should be "listed"
      expect(screen.getAllByTestId("card-status")[0]).toHaveTextContent(
        "listed",
      );

      // Second listing (rented) should be "rented"
      expect(screen.getAllByTestId("card-status")[1]).toHaveTextContent(
        "rented",
      );
    });

    it("should handle unknown status gracefully", () => {
      const listingsWithUnknownStatus = [
        {
          ...mockListings[0],
          status: "unknown",
        },
      ];

      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: listingsWithUnknownStatus,
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getByTestId("card-status")).toHaveTextContent("");
    });
  });

  describe("Status Conversion", () => {
    it("should convert 'available' to 'listed'", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getAllByTestId("card-status")[0]).toHaveTextContent(
        "listed",
      );
    });

    it("should convert 'rented' to 'rented'", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getAllByTestId("card-status")[1]).toHaveTextContent(
        "rented",
      );
    });

    it("should convert unknown status to empty string", () => {
      const listingsWithUnknownStatus = [
        {
          ...mockListings[0],
          status: "maintenance",
        },
      ];

      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: listingsWithUnknownStatus,
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getByTestId("card-status")).toHaveTextContent("");
    });
  });

  describe("List an item Card", () => {
    it("should render add new listing card with correct styling", () => {
      const { container } = renderWithQueryClient(
        <ActiveListings filters={mockFilters} />,
      );

      const addCard = container.querySelector('div[class*="border-dashed"]');
      expect(addCard).toHaveClass(
        "items-center justify-center overflow-hidden border-dashed",
      );
    });

    it("should have correct link to add listing page", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      const addLink = screen.getByRole("link", { name: /List an item/ });
      expect(addLink).toHaveAttribute("href", "/dashboard/listings/add");
    });

    it("should have plus icon and title", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getByText("List another item")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Share your tools with neighbors and earn extra income",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Styling and Layout", () => {
    it("should have correct grid layout classes", () => {
      const { container } = renderWithQueryClient(
        <ActiveListings filters={mockFilters} />,
      );

      const grid = container.querySelector('div[class*="grid"]');
      expect(grid).toHaveClass("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ");
    });

    it("should have correct empty state container", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: [],
      });

      const { container } = renderWithQueryClient(
        <ActiveListings filters={mockFilters} />,
      );

      const emptyState = container.querySelector('div[class*="col-span-full"]');
      expect(emptyState).toHaveClass("col-span-full");
    });

    it("should have icon in empty state", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: [],
      });

      const { container } = renderWithQueryClient(
        <ActiveListings filters={mockFilters} />,
      );

      const iconContainer = container.querySelector(
        'div[class*="rounded-full"][class*="bg-primary"]',
      );
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible link text", () => {
      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      const link = screen.getByRole("link", { name: /List an item/ });
      expect(link).toBeInTheDocument();
    });

    it("should have proper heading for empty state", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: [],
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(
        screen.getByText("Start earning from things you already own"),
      ).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null data gracefully", () => {
      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: null,
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(
        screen.getByText("Start earning from things you already own"),
      ).toBeInTheDocument();
    });

    it("should handle undefined image URL", () => {
      const listingWithoutImage = [
        {
          ...mockListings[0],
          firstImageUrl: undefined,
        },
      ];

      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: listingWithoutImage,
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getByTestId("card-image")).toHaveTextContent("");
    });

    it("should handle inactive listings correctly", () => {
      const inactiveListing = [
        {
          ...mockListings[0],
          isActive: false,
        },
      ];

      (useActiveListings as any).mockReturnValue({
        ...mockUseActiveListings,
        data: inactiveListing,
      });

      renderWithQueryClient(<ActiveListings filters={mockFilters} />);

      expect(screen.getByTestId("card-is-active")).toHaveTextContent(
        "inactive",
      );
    });
  });
});
