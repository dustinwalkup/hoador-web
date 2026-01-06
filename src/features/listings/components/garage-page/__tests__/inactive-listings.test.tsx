import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InactiveListings } from "../inactive-listings";

// Mock all dependencies
vi.mock("@/features/listings/hooks/use-garage", () => ({
  useInactiveListings: vi.fn(),
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

vi.mock("@/components/ui/card", () => ({
  Card: vi.fn(({ children, className }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  )),
  CardContent: vi.fn(({ children, className }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  )),
  CardTitle: vi.fn(({ children, className }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  )),
}));

vi.mock("@/components/ui/button", () => ({
  Button: vi.fn(({ children, asChild, ...props }) => {
    if (asChild) {
      return <div data-testid="button">{children}</div>;
    }
    return (
      <button data-testid="button" {...props}>
        {children}
      </button>
    );
  }),
}));

vi.mock("@/lib/utils", () => ({
  capitalize: vi.fn((str) => str.charAt(0).toUpperCase() + str.slice(1)),
}));

vi.mock("lucide-react", () => ({
  Plus: vi.fn(() => <div data-testid="plus-icon" />),
  Settings: vi.fn(() => <div data-testid="settings-icon" />),
}));

vi.mock("next/link", () => ({
  default: vi.fn(({ children, href }) => (
    <a data-testid="link" href={href}>
      {children}
    </a>
  )),
}));

import { useInactiveListings } from "@/features/listings/hooks/use-garage";
import { Button } from "@/components/ui/button";
import { capitalize } from "@/lib/utils";

describe("InactiveListings", () => {
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
      status: "maintenance",
      isActive: false,
    },
    {
      id: "listing-2",
      name: "Hammer",
      dailyRate: 5.99,
      firstImageUrl: "https://example.com/hammer.jpg",
      status: "inactive",
      isActive: false,
    },
  ];

  const mockUseInactiveListings = {
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
    (useInactiveListings as any).mockReturnValue(mockUseInactiveListings);
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
        renderWithQueryClient(<InactiveListings filters={mockFilters} />),
      ).not.toThrow();
    });

    it("should render grid container with correct classes", () => {
      const { container } = renderWithQueryClient(
        <InactiveListings filters={mockFilters} />,
      );

      const grid = container.querySelector('div[class*="grid"]');
      expect(grid).toHaveClass(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      );
    });

    it("should render rental cards for each listing", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByTestId("rental-card-listing-1")).toBeInTheDocument();
      expect(screen.getByTestId("rental-card-listing-2")).toBeInTheDocument();
    });

    it("should render add new listing card", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByText("List a New listing")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Share your tools with neighbors and earn extra income",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Add New Listing/ }),
      ).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should render loading skeleton when isLoading is true", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        isLoading: true,
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
      expect(
        screen.queryByTestId("rental-card-listing-1"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Error States", () => {
    it("should render error component when error exists", () => {
      const mockError = new Error("Failed to load listings");
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        error: mockError,
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByText("Failed to load listings")).toBeInTheDocument();
      expect(screen.getByTestId("error-component")).toBeInTheDocument();
    });

    it("should call refetch when retry button is clicked", () => {
      const mockError = new Error("Network error");
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        error: mockError,
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      const retryButton = screen.getByRole("button", { name: "Retry" });
      retryButton.click();

      expect(mockUseInactiveListings.refetch).toHaveBeenCalled();
    });
  });

  describe("Empty States", () => {
    it("should render empty state when no listings", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: [],
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByText("No inactive listings")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Listings in maintenance or marked as inactive will appear here",
        ),
      ).toBeInTheDocument();
    });

    it("should render filtered empty state when filters are applied", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: [],
      });

      const filtersWithQuery = { ...mockFilters, query: "drill" };

      renderWithQueryClient(<InactiveListings filters={filtersWithQuery} />);

      expect(
        screen.getByText(
          "No inactive listings found matching your search criteria",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Try adjusting your search or filters"),
      ).toBeInTheDocument();
    });

    it("should render filtered empty state when category filter is applied", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: [],
      });

      const filtersWithCategory = { ...mockFilters, categoryId: "power-tools" };

      renderWithQueryClient(<InactiveListings filters={filtersWithCategory} />);

      expect(
        screen.getByText(
          "No inactive listings found matching your search criteria",
        ),
      ).toBeInTheDocument();
    });

    it("should still render add new listing card in empty state", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: [],
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByText("List a New listing")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Add New Listing/ }),
      ).toBeInTheDocument();
    });
  });

  describe("RentalCard Props", () => {
    it("should pass correct props to RentalCard", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

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
        "",
      );
      expect(within(firstCard).getByTestId("card-price")).toHaveTextContent(
        "$15.99/day",
      );
      expect(
        within(firstCard).getByTestId("card-availability"),
      ).toHaveTextContent("Maintenance");
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
      ).toHaveTextContent("maintenance");
      expect(within(firstCard).getByTestId("card-is-active")).toHaveTextContent(
        "inactive",
      );
    });
  });

  describe("Status Handling", () => {
    it("should always pass empty string as status to RentalCard", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      const statusElements = screen.getAllByTestId("card-status");
      expect(statusElements[0]).toHaveTextContent("");
      expect(statusElements[1]).toHaveTextContent("");
    });

    it("should capitalize availability status", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getAllByTestId("card-availability")[0]).toHaveTextContent(
        "Maintenance",
      );
      expect(screen.getAllByTestId("card-availability")[1]).toHaveTextContent(
        "Inactive",
      );
    });

    it("should call capitalize function for availability", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(capitalize).toHaveBeenCalledWith("maintenance");
      expect(capitalize).toHaveBeenCalledWith("inactive");
    });
  });

  describe("Add New Listing Card", () => {
    it("should render add new listing card with correct styling", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      const addCard = screen.getByTestId("card");
      expect(addCard).toHaveClass(
        "items-center justify-center overflow-hidden border-dashed",
      );
    });

    it("should have correct link to add listing page", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      const addLink = screen.getByRole("link", { name: /Add New Listing/ });
      expect(addLink).toHaveAttribute("href", "/dashboard/listings/add");
    });

    it("should have plus icon and title", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
      expect(screen.getByText("List a New listing")).toBeInTheDocument();
    });

    it("should have correct button styling", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(Button).toHaveBeenCalledWith(
        expect.objectContaining({
          asChild: true,
        }),
        undefined,
      );
    });
  });

  describe("Styling and Layout", () => {
    it("should have correct grid layout classes", () => {
      const { container } = renderWithQueryClient(
        <InactiveListings filters={mockFilters} />,
      );

      const grid = container.querySelector('div[class*="grid"]');
      expect(grid).toHaveClass(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      );
    });

    it("should have correct empty state styling", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: [],
      });

      const { container } = renderWithQueryClient(
        <InactiveListings filters={mockFilters} />,
      );

      const emptyState = container.querySelector('div[class*="col-span-full"]');
      expect(emptyState).toHaveClass("col-span-full py-8 text-center");
    });

    it("should have correct icon styling in empty state", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: [],
      });

      const { container } = renderWithQueryClient(
        <InactiveListings filters={mockFilters} />,
      );

      const iconContainer = container.querySelector(
        'div[class*="bg-muted"][class*="rounded-full"]',
      );
      expect(iconContainer).toHaveClass(
        "bg-muted mb-4 inline-flex rounded-full p-3",
      );
    });
  });

  describe("Accessibility", () => {
    it("should have accessible link text", () => {
      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      const link = screen.getByRole("link", { name: /Add New Listing/ });
      expect(link).toBeInTheDocument();
    });

    it("should have proper heading for empty state", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: [],
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      // Empty state should have proper text structure
      expect(screen.getByText("No inactive listings")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null data gracefully", () => {
      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: null,
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      // Should render empty state
      expect(screen.getByText("No inactive listings")).toBeInTheDocument();
    });

    it("should handle undefined image URL", () => {
      const listingWithoutImage = [
        {
          ...mockListings[0],
          firstImageUrl: undefined,
        },
      ];

      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: listingWithoutImage,
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByTestId("card-image")).toHaveTextContent("");
    });

    it("should handle active listings correctly", () => {
      const activeListing = [
        {
          ...mockListings[0],
          isActive: true,
        },
      ];

      (useInactiveListings as any).mockReturnValue({
        ...mockUseInactiveListings,
        data: activeListing,
      });

      renderWithQueryClient(<InactiveListings filters={mockFilters} />);

      expect(screen.getByTestId("card-is-active")).toHaveTextContent("active");
    });
  });
});
