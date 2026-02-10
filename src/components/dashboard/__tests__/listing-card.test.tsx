import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ListingCard from "../listing-card";

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock Next.js Image
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: any) => <img {...props} alt={props.alt || ""} />,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  MapPin: () => <div data-testid="map-pin-icon" />,
  Star: () => <div data-testid="star-icon" />,
  Truck: () => <div data-testid="truck-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
}));

describe("ListingCard", () => {
  const defaultProps = {
    id: "listing-123",
    name: "Power Drill",
    price: "$15.99",
    rating: 4.5,
    reviews: 12,
    imageUrl: "https://example.com/drill.jpg",
    status: "available",
    deliveryMode: "pickup_only" as const,
    setupAvailable: false,
  };

  it("should render listing name and price", () => {
    render(<ListingCard {...defaultProps} />);

    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText("$15.99")).toBeInTheDocument();
  });

  it("should render rating and reviews", () => {
    render(<ListingCard {...defaultProps} />);

    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12 reviews)")).toBeInTheDocument();
  });

  it("should render star icon", () => {
    render(<ListingCard {...defaultProps} />);

    expect(screen.getByTestId("star-icon")).toBeInTheDocument();
  });

  it("should render image with correct props", () => {
    render(<ListingCard {...defaultProps} />);

    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", "https://example.com/drill.jpg");
    expect(image).toHaveAttribute("alt", "Power Drill");
  });

  it("should render placeholder image when imageUrl is not provided", () => {
    render(<ListingCard {...defaultProps} imageUrl="" />);

    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", "/images/placeholder.jpg");
  });

  it("should render as a link to listing detail page", () => {
    render(<ListingCard {...defaultProps} />);

    const viewButton = screen.getByText("View");
    expect(viewButton.closest("a")).toHaveAttribute(
      "href",
      "/dashboard/listings/listing-123",
    );
  });

  it("should render status icon", () => {
    render(<ListingCard {...defaultProps} />);

    // StatusIconWithTooltip renders a button with aria-label
    expect(screen.getByLabelText("View listing status")).toBeInTheDocument();
  });

  it("should render delivery badge when delivery is available", () => {
    render(<ListingCard {...defaultProps} deliveryMode="delivery_only" />);

    expect(screen.getByText("Delivery")).toBeInTheDocument();
  });

  it("should render setup badge when setup is available", () => {
    render(<ListingCard {...defaultProps} setupAvailable={true} />);

    expect(screen.getByText("Setup")).toBeInTheDocument();
  });

  it("should not render delivery badge for pickup only", () => {
    render(<ListingCard {...defaultProps} deliveryMode="pickup_only" />);

    expect(screen.queryByText("Delivery")).not.toBeInTheDocument();
  });

  it("should render distance when provided", () => {
    render(<ListingCard {...defaultProps} distance={2.5} />);

    expect(screen.getByText("2.5 mi away")).toBeInTheDocument();
  });

  it("should format distance less than 0.1 miles as feet", () => {
    render(<ListingCard {...defaultProps} distance={0.05} />);

    expect(screen.getByText("< 0.1 mi away")).toBeInTheDocument();
  });

  it("should format distance less than 1 mile as feet", () => {
    render(<ListingCard {...defaultProps} distance={0.7} />);

    expect(screen.getByText("3696 ft away")).toBeInTheDocument();
  });

  it("should format distance 10+ miles as whole number", () => {
    render(<ListingCard {...defaultProps} distance={15.7} />);

    expect(screen.getByText("16 mi away")).toBeInTheDocument();
  });

  it("should not render distance when undefined", () => {
    render(<ListingCard {...defaultProps} distance={undefined} />);

    expect(screen.queryByText(/away/)).not.toBeInTheDocument();
  });

  it("should render new badge when isNew is true", () => {
    render(<ListingCard {...defaultProps} isNew={true} />);

    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("should not render new badge when isNew is false", () => {
    render(<ListingCard {...defaultProps} isNew={false} />);

    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("should apply hover styles", () => {
    render(<ListingCard {...defaultProps} />);

    const card = screen.getByText("View").closest('[data-slot="card"]');
    expect(card).toHaveClass(
      "group",
      "overflow-hidden",
      "pt-0",
      "pb-2",
      "transition-all",
      "duration-200",
      "hover:-translate-y-1",
      "hover:shadow-lg",
    );
  });

  it("should render proper accessibility attributes", () => {
    render(<ListingCard {...defaultProps} />);

    const viewLink = screen.getByText("View").closest("a");
    expect(viewLink).toHaveAttribute("href", "/dashboard/listings/listing-123");

    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("alt", "Power Drill");
  });

  it("should handle different status values", () => {
    const statuses = ["available", "rented", "maintenance", "inactive"];

    statuses.forEach((status) => {
      const { unmount } = render(
        <ListingCard {...defaultProps} status={status} />,
      );
      expect(screen.getByLabelText("View listing status")).toBeInTheDocument();
      unmount();
    });
  });

  it("should render card content structure", () => {
    render(<ListingCard {...defaultProps} />);

    // Should have proper card structure
    const card = screen.getByText("View").closest('[data-slot="card"]');
    expect(card).toBeInTheDocument();

    // Should have CardContent
    const cardContent = screen
      .getByText("Power Drill")
      .closest('[class*="flex flex-1 flex-col"]');
    expect(cardContent).toBeInTheDocument();
  });

  it("should handle long listing names", () => {
    const longName =
      "Very Long Power Drill Name That Might Cause Layout Issues";
    render(<ListingCard {...defaultProps} name={longName} />);

    expect(screen.getByText(longName)).toBeInTheDocument();
  });

  it("should render with proper responsive classes", () => {
    render(<ListingCard {...defaultProps} />);

    const card = screen.getByText("View").closest('[data-slot="card"]');
    expect(card).toHaveClass("group", "overflow-hidden");
  });

  it("should handle zero rating", () => {
    render(<ListingCard {...defaultProps} rating={0} reviews={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("(0 reviews)")).toBeInTheDocument();
  });

  it("should handle high rating", () => {
    render(<ListingCard {...defaultProps} rating={5} reviews={100} />);

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("(100 reviews)")).toBeInTheDocument();
  });
});
