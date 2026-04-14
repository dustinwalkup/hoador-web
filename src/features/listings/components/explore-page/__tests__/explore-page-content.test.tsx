import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ExplorePageContent } from "../explore-page-content";
import type { UserListing } from "@/dal/listing.dal";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} data-testid="next-link">
      {children}
    </a>
  ),
}));

// Mock ListingCard component
vi.mock("@/components/dashboard/listing-card", () => ({
  default: vi.fn(
    ({
      id,
      name,
      price,
      distance,
      rating,
      reviews,
      imageUrl,
      isNew,
      status,
    }) => (
      <div data-testid={`listing-card-${id}`}>
        <div data-testid="card-name">{name}</div>
        <div data-testid="card-price">{price}</div>
        <div data-testid="card-distance">{distance}</div>
        <div data-testid="card-rating">{rating}</div>
        <div data-testid="card-reviews">{reviews}</div>
        <div data-testid="card-image">{imageUrl}</div>
        <div data-testid="card-is-new">{isNew ? "new" : "old"}</div>
        <div data-testid="card-status">{status}</div>
      </div>
    ),
  ),
}));

describe("ExplorePageContent", () => {
  const mockListings: UserListing[] = [
    {
      id: "listing-1",
      name: "Power Drill",
      dailyRate: 15.99,
      weeklyRate: 90.0,
      monthlyRate: 300.0,
      securityDeposit: 50.0,
      deliveryFee: 10.0,
      setupFee: 25.0,
      averageRating: 4.5,
      reviewCount: 10,
      firstImageUrl: "https://example.com/drill.jpg",
      distanceMiles: 2.5,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago - should be "new"
      updatedAt: new Date("2024-01-15"),
      ownerId: "user-1",
      categoryId: "power-tools",
      communityId: "community-1",
      description: "Heavy duty drill",
      brand: "DeWalt",
      model: "DCD777C2",
      condition: "good",
      status: "available",
      instructions: "Insert battery and use trigger",
      safetyNotes: "Wear safety glasses",
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 30,
      deliveryMode: "pickup_only",
      deliveryRadius: 10,
      setupAvailable: true,
      isActive: true,
      viewCount: 0,
      favoriteCount: 0,
      specifications: { power: "20V MAX" },
      approvalStatus: "approved",
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
    },
    {
      id: "listing-2",
      name: "Hammer",
      dailyRate: 5.99,
      weeklyRate: 30.0,
      monthlyRate: 100.0,
      securityDeposit: 10.0,
      deliveryFee: 5.0,
      setupFee: 0,
      averageRating: 4.2,
      reviewCount: 5,
      firstImageUrl: null, // Should use placeholder
      distanceMiles: 5.0,
      createdAt: new Date("2023-12-01"), // Old - should not be "new"
      updatedAt: new Date("2023-12-01"),
      ownerId: "user-2",
      categoryId: "hand-tools",
      communityId: "community-1",
      description: "Basic hammer",
      brand: "Stanley",
      model: "51-624",
      condition: "excellent",
      status: "rented",
      instructions: "Use carefully",
      safetyNotes: "Wear gloves",
      minimumRentalPeriod: 1,
      maximumRentalPeriod: 14,
      deliveryMode: "delivery_only",
      deliveryRadius: 15,
      setupAvailable: false,
      isActive: true,
      viewCount: 0,
      favoriteCount: 0,
      specifications: { weight: "16 oz" },
      approvalStatus: "approved",
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("With Listings", () => {
    it("should render listings grid when listings are provided", () => {
      const { container } = render(
        <ExplorePageContent listings={mockListings} />,
      );

      const grid = container.querySelector('div[class*="grid"]');
      expect(grid).toHaveClass("grid gap-6 sm:grid-cols-2 lg:grid-cols-3");

      // Should render 2 listing cards
      expect(screen.getByTestId("listing-card-listing-1")).toBeInTheDocument();
      expect(screen.getByTestId("listing-card-listing-2")).toBeInTheDocument();
    });

    it("should pass correct props to ListingCard components", () => {
      render(<ExplorePageContent listings={mockListings} />);

      // Check first listing props - scope queries to the first listing card
      const firstListingCard = screen.getByTestId("listing-card-listing-1");
      expect(
        within(firstListingCard).getByTestId("card-name"),
      ).toHaveTextContent("Power Drill");
      expect(
        within(firstListingCard).getByTestId("card-price"),
      ).toHaveTextContent("$15.99/day");
      expect(
        within(firstListingCard).getByTestId("card-distance"),
      ).toHaveTextContent("2.5");
      expect(
        within(firstListingCard).getByTestId("card-rating"),
      ).toHaveTextContent("4.5");
      expect(
        within(firstListingCard).getByTestId("card-reviews"),
      ).toHaveTextContent("10");
      expect(
        within(firstListingCard).getByTestId("card-image"),
      ).toHaveTextContent("https://example.com/drill.jpg");
      expect(
        within(firstListingCard).getByTestId("card-is-new"),
      ).toHaveTextContent("new");
      expect(
        within(firstListingCard).getByTestId("card-status"),
      ).toHaveTextContent("available");
    });

    it("should calculate 'new' status correctly", () => {
      render(<ExplorePageContent listings={mockListings} />);

      const newStatusElements = screen.getAllByTestId("card-is-new");

      // First listing should be new (created within 7 days)
      expect(newStatusElements[0]).toHaveTextContent("new");

      // Second listing should be old (created more than 7 days ago)
      expect(newStatusElements[1]).toHaveTextContent("old");
    });

    it("should use placeholder image when firstImageUrl is null", () => {
      render(<ExplorePageContent listings={mockListings} />);

      const imageElements = screen.getAllByTestId("card-image");

      // First listing has image URL
      expect(imageElements[0]).toHaveTextContent(
        "https://example.com/drill.jpg",
      );

      // Second listing should use placeholder
      expect(imageElements[1]).toHaveTextContent("/images/placeholder.jpg");
    });

    it("should render correct number of listing cards", () => {
      render(<ExplorePageContent listings={mockListings} />);

      const listingCards = screen.getAllByTestId(/^listing-card-/);
      expect(listingCards).toHaveLength(2);
    });

    it("should use unique keys for each listing card", () => {
      render(<ExplorePageContent listings={mockListings} />);

      expect(screen.getByTestId("listing-card-listing-1")).toBeInTheDocument();
      expect(screen.getByTestId("listing-card-listing-2")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should render empty state when no listings are provided", () => {
      render(<ExplorePageContent listings={[]} />);

      expect(screen.getByText("Nothing found")).toBeInTheDocument();
    });

    it("should render empty state message and description", () => {
      render(<ExplorePageContent listings={[]} />);

      expect(screen.getByText("Nothing found")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Try adjusting your search or browse everything available/,
        ),
      ).toBeInTheDocument();
    });

    it("should render browse all button in empty state", () => {
      render(<ExplorePageContent listings={[]} />);

      const button = screen.getByRole("link", { name: /Browse all/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("href", "/dashboard/explore");
    });

    it("should use custom basePath for empty state link", () => {
      render(<ExplorePageContent listings={[]} basePath="/explore" />);

      const button = screen.getByRole("link", { name: /Browse all/i });
      expect(button).toHaveAttribute("href", "/explore");
    });

    it("should have proper empty state container", () => {
      const { container } = render(<ExplorePageContent listings={[]} />);

      const emptyStateContainer = container.querySelector(
        'div[class*="min-h-100"]',
      );
      expect(emptyStateContainer).toBeInTheDocument();
    });

    it("should not render grid when no listings", () => {
      render(<ExplorePageContent listings={[]} />);

      // Should not have grid container
      const grids = screen
        .queryAllByRole("generic")
        .filter((element) => element.className?.includes("grid"));
      expect(grids.length).toBe(0);
    });
  });

  describe("Base Path Handling", () => {
    it("should default to /dashboard/explore for basePath", () => {
      render(<ExplorePageContent listings={[]} />);

      const link = screen.getByTestId("next-link");
      expect(link).toHaveAttribute("href", "/dashboard/explore");
    });

    it("should use custom basePath when provided", () => {
      render(<ExplorePageContent listings={[]} basePath="/custom/path" />);

      const link = screen.getByTestId("next-link");
      expect(link).toHaveAttribute("href", "/custom/path");
    });

    it("should pass basePath to empty state button", () => {
      const customPath = "/explore/tools";
      render(<ExplorePageContent listings={[]} basePath={customPath} />);

      const link = screen.getByTestId("next-link");
      expect(link).toHaveAttribute("href", customPath);
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic structure", () => {
      const { container } = render(
        <ExplorePageContent listings={mockListings} />,
      );

      // Should have proper container structure - check for the grid container
      const gridContainer = container.querySelector('div[class*="grid"]');
      expect(gridContainer).toBeInTheDocument();
    });

    it("should have accessible button text", () => {
      render(<ExplorePageContent listings={[]} />);

      const button = screen.getByRole("link", { name: /Browse all/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("should use responsive grid classes", () => {
      const { container } = render(
        <ExplorePageContent listings={mockListings} />,
      );

      const grid = container.querySelector('div[class*="grid"]');
      expect(grid).toHaveClass("grid gap-6 sm:grid-cols-2 lg:grid-cols-3");
    });

    it("should have proper spacing in grid", () => {
      const { container } = render(
        <ExplorePageContent listings={mockListings} />,
      );

      const grid = container.querySelector('div[class*="grid"]');
      expect(grid).toHaveClass("gap-6");
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined distance", () => {
      const listingWithoutDistance: UserListing = {
        ...mockListings[0],
        distanceMiles: undefined,
      };

      render(<ExplorePageContent listings={[listingWithoutDistance]} />);

      const distanceElement = screen.getByTestId("card-distance");
      expect(distanceElement).toHaveTextContent("");
    });

    it("should handle undefined rating and reviews", () => {
      const listingWithoutRating: UserListing = {
        ...mockListings[0],
        averageRating: 0,
        reviewCount: 0,
      };

      render(<ExplorePageContent listings={[listingWithoutRating]} />);

      expect(screen.getByTestId("card-rating")).toHaveTextContent("0");
      expect(screen.getByTestId("card-reviews")).toHaveTextContent("0");
    });

    it("should handle very old listings (not new)", () => {
      const veryOldListing: UserListing = {
        ...mockListings[0],
        createdAt: new Date("2020-01-01"), // Very old
      };

      render(<ExplorePageContent listings={[veryOldListing]} />);

      expect(screen.getByTestId("card-is-new")).toHaveTextContent("old");
    });

    it("should handle listings created exactly 7 days ago (not new)", () => {
      // Use 7 days and 1 second ago to account for timing differences
      // between module load time (when oneWeekAgoTimestamp is computed)
      // and test execution time
      const sevenDaysAndOneSecondAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000,
      );

      const sevenDayOldListing: UserListing = {
        ...mockListings[0],
        createdAt: sevenDaysAndOneSecondAgo,
      };

      render(<ExplorePageContent listings={[sevenDayOldListing]} />);

      expect(screen.getByTestId("card-is-new")).toHaveTextContent("old");
    });
  });

  describe("Performance", () => {
    it("should render efficiently with many listings", () => {
      const manyListings = Array.from({ length: 20 }, (_, i) => ({
        ...mockListings[0],
        id: `listing-${i}`,
        name: `Listing ${i}`,
      }));

      const startTime = performance.now();
      render(<ExplorePageContent listings={manyListings} />);
      const endTime = performance.now();

      // Should render quickly (less than 200ms for 20 items)
      expect(endTime - startTime).toBeLessThan(200);

      // Should render all listings
      expect(screen.getAllByTestId(/^listing-card-/)).toHaveLength(20);
    });
  });
});
