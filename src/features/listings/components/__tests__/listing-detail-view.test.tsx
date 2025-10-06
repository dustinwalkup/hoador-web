import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingDetailView } from "../listing-detail-view";
import type { ListingDetails } from "@/dal/types";

// Mock Next.js components
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }) => <img src={src} alt={alt} {...props} />,
}));

// Mock BackButton component to avoid Next.js router dependency
vi.mock("@/components/back-button", () => ({
  BackButton: () => <button>Back</button>,
}));

describe("ListingDetailView", () => {
  const mockListing: ListingDetails = {
    id: "listing-123",
    name: "Professional Power Drill",
    description: "A high-quality power drill perfect for any project.",
    brand: "DeWalt",
    model: "DCD771C2",
    condition: "excellent",
    dailyRate: 25,
    weeklyRate: 150,
    monthlyRate: 500,
    securityDeposit: 100,
    status: "available",
    specifications: {
      Power: "20V",
      Speed: "0-450/0-1500 RPM",
      Weight: "3.6 lbs",
    },
    instructions: "Always wear safety glasses when operating.",
    safetyNotes: "Keep away from water. Unplug when not in use.",
    minimumRentalPeriod: 1,
    maximumRentalPeriod: 30,
    deliveryMode: "both_available",
    deliveryFee: 10,
    deliveryRadius: 25,
    setupAvailable: false,
    setupFee: 0,
    viewCount: 42,
    favoriteCount: 7,
    averageRating: 4.5,
    reviewCount: 12,
    isFavorited: false,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-20"),
    images: [
      {
        id: "img-1",
        imageUrl: "/test-image-1.jpg",
        orderIndex: 0,
      },
      {
        id: "img-2",
        imageUrl: "/test-image-2.jpg",
        orderIndex: 1,
      },
    ],
    owner: {
      id: "owner-123",
      firstName: "John",
      lastName: "Doe",
      profileImageUrl: "/profile.jpg",
      averageRating: 4.8,
      reviewCount: 25,
      memberSince: new Date("2023-06-01"),
    },
    category: {
      id: "cat-123",
      name: "Power Tools",
      icon: "wrench",
    },
    reviews: [],
    availability: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Rendering", () => {
    it("should render listing name", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Professional Power Drill")).toBeInTheDocument();
    });

    it("should render listing description", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(
        screen.getByText("A high-quality power drill perfect for any project."),
      ).toBeInTheDocument();
    });

    it("should render category badge", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Power Tools")).toBeInTheDocument();
    });

    it("should render condition badge", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("excellent")).toBeInTheDocument();
    });

    it("should render back button", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      // BackButton component should be rendered
      const backButton = screen.getByRole("button", { name: /back/i });
      expect(backButton).toBeInTheDocument();
    });
  });

  describe("Basic Information Display", () => {
    it("should display brand and model", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Brand")).toBeInTheDocument();
      expect(screen.getByText("DeWalt")).toBeInTheDocument();
      expect(screen.getByText("Model")).toBeInTheDocument();
      expect(screen.getByText("DCD771C2")).toBeInTheDocument();
    });

    it("should not display brand section if brand is undefined", () => {
      const listingWithoutBrand = { ...mockListing, brand: undefined };
      render(
        <ListingDetailView listing={listingWithoutBrand} isOwner={false} />,
      );

      expect(screen.queryByText("Brand")).not.toBeInTheDocument();
    });

    it("should not display model section if model is undefined", () => {
      const listingWithoutModel = { ...mockListing, model: undefined };
      render(
        <ListingDetailView listing={listingWithoutModel} isOwner={false} />,
      );

      expect(screen.queryByText("Model")).not.toBeInTheDocument();
    });
  });

  describe("Pricing Information", () => {
    it("should display daily rate", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Daily Rate")).toBeInTheDocument();
      expect(screen.getByText("$25.00")).toBeInTheDocument();
    });

    it("should display weekly rate when available", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Weekly Rate")).toBeInTheDocument();
      expect(screen.getByText("$150.00")).toBeInTheDocument();
    });

    it("should display monthly rate when available", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Monthly Rate")).toBeInTheDocument();
      expect(screen.getByText("$500.00")).toBeInTheDocument();
    });

    it("should display security deposit", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Security Deposit")).toBeInTheDocument();
      expect(screen.getByText("$100.00")).toBeInTheDocument();
    });

    it("should not display weekly rate when not available", () => {
      const listingWithoutWeeklyRate = {
        ...mockListing,
        weeklyRate: undefined,
      };
      render(
        <ListingDetailView
          listing={listingWithoutWeeklyRate}
          isOwner={false}
        />,
      );

      expect(screen.queryByText("Weekly Rate")).not.toBeInTheDocument();
    });
  });

  describe("Rental Period", () => {
    it("should display minimum rental period", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Minimum")).toBeInTheDocument();
      expect(screen.getByText("1 day(s)")).toBeInTheDocument();
    });

    it("should display maximum rental period", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Maximum")).toBeInTheDocument();
      expect(screen.getByText("30 day(s)")).toBeInTheDocument();
    });
  });

  describe("Specifications", () => {
    it("should display specifications section", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      // Specifications appear in both mobile and desktop views, so there are 2 instances
      const specificationsHeadings = screen.getAllByText("Specifications");
      expect(specificationsHeadings).toHaveLength(2);
      expect(specificationsHeadings[0]).toBeInTheDocument();
    });

    it("should display all specification entries", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      // Each spec key appears twice (mobile + desktop), so use getAllByText
      expect(screen.getAllByText("Power")).toHaveLength(2);
      expect(screen.getAllByText("20V")).toHaveLength(2);
      expect(screen.getAllByText("Speed")).toHaveLength(2);
      expect(screen.getAllByText("0-450/0-1500 RPM")).toHaveLength(2);
      expect(screen.getAllByText("Weight")).toHaveLength(2);
      expect(screen.getAllByText("3.6 lbs")).toHaveLength(2);
    });

    it("should not display specifications section when empty", () => {
      const listingWithoutSpecs = { ...mockListing, specifications: {} };
      render(
        <ListingDetailView listing={listingWithoutSpecs} isOwner={false} />,
      );

      expect(screen.queryByText("Specifications")).not.toBeInTheDocument();
    });
  });

  describe("Usage Instructions", () => {
    it("should display usage instructions when available", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Usage Instructions")).toBeInTheDocument();
      expect(
        screen.getByText("Always wear safety glasses when operating."),
      ).toBeInTheDocument();
    });

    it("should not display usage instructions section when not available", () => {
      const listingWithoutInstructions = {
        ...mockListing,
        instructions: undefined,
      };
      render(
        <ListingDetailView
          listing={listingWithoutInstructions}
          isOwner={false}
        />,
      );

      expect(screen.queryByText("Usage Instructions")).not.toBeInTheDocument();
    });
  });

  describe("Safety Notes", () => {
    it("should display safety notes when available", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Safety Notes")).toBeInTheDocument();
      expect(
        screen.getByText("Keep away from water. Unplug when not in use."),
      ).toBeInTheDocument();
    });

    it("should not display safety notes section when not available", () => {
      const listingWithoutSafety = { ...mockListing, safetyNotes: undefined };
      render(
        <ListingDetailView listing={listingWithoutSafety} isOwner={false} />,
      );

      expect(screen.queryByText("Safety Notes")).not.toBeInTheDocument();
    });
  });

  describe("Pickup & Delivery", () => {
    it("should display delivery options", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Delivery Options")).toBeInTheDocument();
      expect(screen.getByText("Pickup or Delivery")).toBeInTheDocument();
    });

    it("should display pickup only mode", () => {
      const pickupOnlyListing = {
        ...mockListing,
        deliveryMode: "pickup_only" as const,
      };
      render(<ListingDetailView listing={pickupOnlyListing} isOwner={false} />);

      expect(screen.getByText("Delivery Options")).toBeInTheDocument();
      expect(screen.getByText("Pickup Only")).toBeInTheDocument();
    });

    it("should display delivery only mode", () => {
      const deliveryOnlyListing = {
        ...mockListing,
        deliveryMode: "delivery_only" as const,
      };
      render(
        <ListingDetailView listing={deliveryOnlyListing} isOwner={false} />,
      );

      expect(screen.getByText("Delivery Options")).toBeInTheDocument();
      expect(screen.getByText("Delivery Only")).toBeInTheDocument();
    });

    it("should display delivery fee when delivery available", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Delivery Fee")).toBeInTheDocument();
      expect(screen.getByText("$10.00")).toBeInTheDocument();
    });

    it("should display delivery radius when delivery available", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Delivery Radius")).toBeInTheDocument();
      expect(screen.getByText("25 miles")).toBeInTheDocument();
    });

    it("should not display delivery details when pickup only", () => {
      const pickupOnlyListing = {
        ...mockListing,
        deliveryMode: "pickup_only" as const,
      };
      render(<ListingDetailView listing={pickupOnlyListing} isOwner={false} />);

      expect(screen.queryByText("Delivery Fee")).not.toBeInTheDocument();
      expect(screen.queryByText("Delivery Radius")).not.toBeInTheDocument();
    });
  });

  describe("Owner Information", () => {
    it("should display owner name", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("should display listing owner title", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Listing Owner")).toBeInTheDocument();
    });
  });

  // Removed Quick Stats from the test suite as it is not displayed in the component
  // describe("Quick Stats", () => {
  //   it("should display view count", () => {
  //     render(<ListingDetailView listing={mockListing} isOwner={false} />);

  //     expect(screen.getByText("Views")).toBeInTheDocument();
  //     expect(screen.getByText("42")).toBeInTheDocument();
  //   });

  //   it("should display favorite count", () => {
  //     render(<ListingDetailView listing={mockListing} isOwner={false} />);

  //     expect(screen.getByText("Favorites")).toBeInTheDocument();
  //     expect(screen.getByText("7")).toBeInTheDocument();
  //   });

  //   it("should display listing date", () => {
  //     render(<ListingDetailView listing={mockListing} isOwner={false} />);

  //     expect(screen.getByText("Listed")).toBeInTheDocument();
  //     // Date format might vary, just check it includes the year
  //     expect(screen.getByText(/2024/)).toBeInTheDocument();
  //   });
  // });

  describe("Action Buttons - Non-Owner", () => {
    it("should display Rent Tool button for non-owner", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      const rentButton = screen.getByRole("link", { name: /rent tool/i });
      expect(rentButton).toBeInTheDocument();
      expect(rentButton).toHaveAttribute("href", "/listings/listing-123/rent");
    });

    it("should display Message Owner button for non-owner", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      const messageButton = screen.getByRole("button", {
        name: /message owner/i,
      });
      expect(messageButton).toBeInTheDocument();
    });

    it("should not display Edit Listing button for non-owner", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.queryByText("Edit Listing")).not.toBeInTheDocument();
    });
  });

  describe("Action Buttons - Owner", () => {
    it("should display Edit Listing button for owner", () => {
      render(<ListingDetailView listing={mockListing} isOwner={true} />);

      const editButton = screen.getByRole("link", { name: /edit listing/i });
      expect(editButton).toBeInTheDocument();
      expect(editButton).toHaveAttribute(
        "href",
        "/dashboard/listings/listing-123/edit",
      );
    });

    it("should not display Rent Tool button for owner", () => {
      render(<ListingDetailView listing={mockListing} isOwner={true} />);

      expect(
        screen.queryByRole("link", { name: /rent tool/i }),
      ).not.toBeInTheDocument();
    });

    it("should not display Message Owner button for owner", () => {
      render(<ListingDetailView listing={mockListing} isOwner={true} />);

      expect(
        screen.queryByRole("button", { name: /message owner/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Condition Badge Styling", () => {
    it("should apply correct color for excellent condition", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      const badge = screen.getByText("excellent");
      expect(badge).toHaveClass("bg-green-100");
    });

    it("should apply correct color for good condition", () => {
      const goodListing = { ...mockListing, condition: "good" };
      render(<ListingDetailView listing={goodListing} isOwner={false} />);

      const badge = screen.getByText("good");
      expect(badge).toHaveClass("bg-blue-100");
    });

    it("should apply correct color for fair condition", () => {
      const fairListing = { ...mockListing, condition: "fair" };
      render(<ListingDetailView listing={fairListing} isOwner={false} />);

      const badge = screen.getByText("fair");
      expect(badge).toHaveClass("bg-yellow-100");
    });

    it("should apply correct color for poor condition", () => {
      const poorListing = { ...mockListing, condition: "poor" };
      render(<ListingDetailView listing={poorListing} isOwner={false} />);

      const badge = screen.getByText("poor");
      expect(badge).toHaveClass("bg-red-100");
    });

    it("should apply default color for unknown condition", () => {
      const unknownListing = { ...mockListing, condition: "unknown" };
      render(<ListingDetailView listing={unknownListing} isOwner={false} />);

      const badge = screen.getByText("unknown");
      expect(badge).toHaveClass("bg-gray-100");
    });
  });

  describe("Image Carousel", () => {
    it("should render image carousel component", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      // Image carousel should display the first image
      const image = screen.getByAltText("Professional Power Drill - Image 1");
      expect(image).toBeInTheDocument();
    });

    it("should pass images to carousel", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      // Verify images are passed correctly
      expect(
        screen.getByAltText("Professional Power Drill - Image 1"),
      ).toHaveAttribute("src", "/test-image-1.jpg");
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading hierarchy", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      const heading = screen.getByText("Professional Power Drill");
      // CardTitle might render as div, just check it exists
      expect(heading).toBeInTheDocument();
      expect(heading.className).toContain("text-2xl");
    });

    it("should have descriptive section titles", () => {
      render(<ListingDetailView listing={mockListing} isOwner={false} />);

      expect(screen.getByText("Pricing")).toBeInTheDocument();
      expect(screen.getByText("Rental Period")).toBeInTheDocument();
      // expect(screen.getByText("Quick Stats")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero security deposit", () => {
      const listingWithNoDeposit = { ...mockListing, securityDeposit: 0 };
      render(
        <ListingDetailView listing={listingWithNoDeposit} isOwner={false} />,
      );

      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });

    it("should handle zero delivery fee", () => {
      const listingWithFreeDelivery = { ...mockListing, deliveryFee: 0 };
      render(
        <ListingDetailView listing={listingWithFreeDelivery} isOwner={false} />,
      );

      expect(screen.getByText("$0.00")).toBeInTheDocument();
    });

    it("should handle empty owner name parts", () => {
      const listingWithEmptyOwnerName = {
        ...mockListing,
        owner: { ...mockListing.owner, firstName: "", lastName: "" },
      };
      render(
        <ListingDetailView
          listing={listingWithEmptyOwnerName}
          isOwner={false}
        />,
      );

      // Component should still render without crashing
      expect(screen.getByText("Listing Owner")).toBeInTheDocument();
    });
  });

  // describe("Date Formatting", () => {
  //   it("should format listing creation date correctly", () => {
  //     render(<ListingDetailView listing={mockListing} isOwner={false} />);

  //     // Check that the formatted date appears (might be in different format in DOM)
  //     const dateText = screen.getByText(/january.*2024/i);
  //     expect(dateText).toBeInTheDocument();
  //   });

  //   it("should handle different date formats", () => {
  //     const listingWithDifferentDate = {
  //       ...mockListing,
  //       createdAt: new Date("2024-12-25"),
  //     };
  //     render(
  //       <ListingDetailView
  //         listing={listingWithDifferentDate}
  //         isOwner={false}
  //       />,
  //     );

  //     // Check date includes December and 2024
  //     expect(screen.getByText(/december.*2024/i)).toBeInTheDocument();
  //   });
  // });

  describe("Component Integration", () => {
    it("should update when listing prop changes", () => {
      const { rerender } = render(
        <ListingDetailView listing={mockListing} isOwner={false} />,
      );

      expect(screen.getByText("Professional Power Drill")).toBeInTheDocument();

      const updatedListing = { ...mockListing, name: "Updated Tool Name" };
      rerender(<ListingDetailView listing={updatedListing} isOwner={false} />);

      expect(screen.getByText("Updated Tool Name")).toBeInTheDocument();
    });

    it("should update when isOwner prop changes", () => {
      const { rerender } = render(
        <ListingDetailView listing={mockListing} isOwner={false} />,
      );

      expect(
        screen.getByRole("link", { name: /rent tool/i }),
      ).toBeInTheDocument();

      rerender(<ListingDetailView listing={mockListing} isOwner={true} />);

      expect(
        screen.getByRole("link", { name: /edit listing/i }),
      ).toBeInTheDocument();
    });
  });
});
