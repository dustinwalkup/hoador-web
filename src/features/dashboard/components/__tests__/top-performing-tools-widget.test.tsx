import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopPerformingToolsWidget } from "../top-performing-tools-widget";
import { ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children as ReactNode}</a>
  ),
}));

describe("TopPerformingToolsWidget", () => {
  it("should show empty state when listings array is empty", () => {
    render(<TopPerformingToolsWidget listings={[]} />);
    expect(screen.getByText("No top performers yet")).toBeInTheDocument();
    expect(
      screen.getByText("Your best-rented items will show here"),
    ).toBeInTheDocument();
  });

  it("should render listings with name and metricText and link to listing", () => {
    const listings = [
      {
        listingId: "listing-1",
        name: "Power Drill",
        metricText: "5 rentals",
      },
      {
        listingId: "listing-2",
        name: "Saw",
        metricText: "4.8 stars",
      },
    ];
    render(<TopPerformingToolsWidget listings={listings} />);

    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText("5 rentals")).toBeInTheDocument();
    expect(screen.getByText("Saw")).toBeInTheDocument();
    expect(screen.getByText("4.8 stars")).toBeInTheDocument();

    const drillLink = screen.getByRole("link", { name: /Power Drill/i });
    expect(drillLink).toHaveAttribute("href", "/dashboard/listings/listing-1");
  });

  it("should link View Garage to /dashboard/listings/rentals", () => {
    const listings = [
      { listingId: "l1", name: "Drill", metricText: "1 rental" },
    ];
    render(<TopPerformingToolsWidget listings={listings} />);
    const viewGarage = screen.getByRole("link", { name: /View Garage/i });
    expect(viewGarage).toHaveAttribute("href", "/dashboard/listings/rentals");
  });
});
