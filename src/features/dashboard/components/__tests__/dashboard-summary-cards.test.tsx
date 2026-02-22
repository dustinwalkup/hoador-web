import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSummaryCards } from "../dashboard-summary-cards";

describe("DashboardSummaryCards", () => {
  it("should render four cards with correct labels and values", () => {
    render(
      <DashboardSummaryCards
        activeRentalsCount={3}
        toolsLentCount={5}
        pendingRequestsCount={2}
        earningsThisMonth={450}
      />,
    );

    expect(screen.getByText("Active Rentals")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Items Lent")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Pending Requests")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("This Month")).toBeInTheDocument();
    expect(screen.getByText("$450")).toBeInTheDocument();
  });

  it("should format earnings as currency", () => {
    render(
      <DashboardSummaryCards
        activeRentalsCount={0}
        toolsLentCount={0}
        pendingRequestsCount={0}
        earningsThisMonth={1234}
      />,
    );
    expect(screen.getByText("$1,234")).toBeInTheDocument();
  });

  it("should show loading state when isLoading is true", () => {
    render(
      <DashboardSummaryCards
        activeRentalsCount={0}
        toolsLentCount={0}
        pendingRequestsCount={0}
        earningsThisMonth={0}
        isLoading
      />,
    );
    const cards = document.querySelectorAll('[class*="animate-pulse"]');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it("should show error state when error is provided", () => {
    const errorMessage = "Failed to load summary";
    render(
      <DashboardSummaryCards
        activeRentalsCount={0}
        toolsLentCount={0}
        pendingRequestsCount={0}
        earningsThisMonth={0}
        error={errorMessage}
      />,
    );
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
