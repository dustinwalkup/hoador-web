import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiniAnalyticsSection } from "../mini-analytics-section";

describe("MiniAnalyticsSection", () => {
  const emptyAnalytics = {
    rentalsPerMonth: [],
    earningsByMonth: [],
    inventoryUsage: {
      activeCount: 0,
      totalCount: 0,
      usagePercent: 0,
    },
  };

  it("should show empty state when no rentals data", () => {
    render(<MiniAnalyticsSection analytics={emptyAnalytics} />);
    expect(
      screen.getAllByText("Not enough data yet").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("should show Rentals per month, Earnings trend, Inventory usage sections", () => {
    render(<MiniAnalyticsSection analytics={emptyAnalytics} />);
    expect(screen.getByText("Rentals per month")).toBeInTheDocument();
    expect(screen.getByText("Earnings trend")).toBeInTheDocument();
    expect(screen.getByText("Inventory usage")).toBeInTheDocument();
  });

  it("should render rentals data when hasRentalsData is true", () => {
    const analytics = {
      rentalsPerMonth: [
        {
          year: 2024,
          month: 1,
          monthLabel: "Jan 2024",
          renterCount: 2,
          ownerCount: 1,
        },
      ],
      earningsByMonth: [],
      inventoryUsage: { activeCount: 0, totalCount: 0, usagePercent: 0 },
    };
    render(<MiniAnalyticsSection analytics={analytics} />);
    expect(screen.getByText("Jan 2024")).toBeInTheDocument();
    expect(screen.getByText(/3 total/)).toBeInTheDocument();
  });

  it("should render earnings data when hasEarningsData is true", () => {
    const analytics = {
      rentalsPerMonth: [],
      earningsByMonth: [
        {
          year: 2024,
          month: 1,
          monthLabel: "Jan 2024",
          amount: 150,
        },
      ],
      inventoryUsage: { activeCount: 0, totalCount: 0, usagePercent: 0 },
    };
    render(<MiniAnalyticsSection analytics={analytics} />);
    expect(screen.getByText("$150")).toBeInTheDocument();
  });

  it("should show No listings yet when inventory totalCount is 0", () => {
    render(<MiniAnalyticsSection analytics={emptyAnalytics} />);
    expect(screen.getByText("No listings yet")).toBeInTheDocument();
  });

  it("should render inventory usage when totalCount > 0", () => {
    const analytics = {
      rentalsPerMonth: [],
      earningsByMonth: [],
      inventoryUsage: {
        activeCount: 3,
        totalCount: 5,
        usagePercent: 60,
      },
    };
    render(<MiniAnalyticsSection analytics={analytics} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText(/3 of 5/)).toBeInTheDocument();
  });
});
