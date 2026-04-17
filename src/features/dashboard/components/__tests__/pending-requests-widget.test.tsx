import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { PendingRequestsWidget } from "../pending-requests-widget";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const rentalItem = {
  id: "req-1",
  listingName: "Power Drill",
  requesterName: "Jane Doe",
  statusText: "Awaiting your response",
  requestDetailUrl: "/dashboard/rental/req-1?view=lending",
};

const serviceItem = {
  id: "sb-1",
  listingName: "Lawn Mowing",
  requesterName: "John Smith",
  statusText: "Awaiting your confirmation",
  requestDetailUrl: "/dashboard/services/bookings/sb-1",
};

describe("PendingRequestsWidget", () => {
  it("should return null when both counts are 0", () => {
    const { container } = render(
      <PendingRequestsWidget
        rentalItems={[]}
        rentalTotalCount={0}
        serviceItems={[]}
        serviceTotalCount={0}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render rental items with link to request detail", () => {
    render(
      <PendingRequestsWidget
        rentalItems={[rentalItem]}
        rentalTotalCount={1}
        serviceItems={[]}
        serviceTotalCount={0}
      />,
    );

    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Power Drill/i });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/rental/req-1?view=lending",
    );
  });

  it("should render service items with link to booking detail", () => {
    render(
      <PendingRequestsWidget
        rentalItems={[]}
        rentalTotalCount={0}
        serviceItems={[serviceItem]}
        serviceTotalCount={1}
      />,
    );

    expect(screen.getByText("Lawn Mowing")).toBeInTheDocument();
    expect(screen.getByText(/John Smith/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Lawn Mowing/i });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/services/bookings/sb-1",
    );
  });

  it("should render both rental and service sections together", () => {
    render(
      <PendingRequestsWidget
        rentalItems={[rentalItem]}
        rentalTotalCount={1}
        serviceItems={[serviceItem]}
        serviceTotalCount={1}
      />,
    );

    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText("Lawn Mowing")).toBeInTheDocument();
    expect(screen.getByText("Rental requests")).toBeInTheDocument();
    expect(screen.getByText("Service requests")).toBeInTheDocument();
    // Total badge shows combined count
    expect(screen.getByText("2 requests")).toBeInTheDocument();
  });

  it("should show View All for rentals when totalCount exceeds items length", () => {
    render(
      <PendingRequestsWidget
        rentalItems={[rentalItem]}
        rentalTotalCount={10}
        serviceItems={[]}
        serviceTotalCount={0}
      />,
    );

    const viewAll = screen.getByRole("link", { name: /View All/i });
    expect(viewAll).toHaveAttribute(
      "href",
      "/dashboard/rentals/incoming/requests",
    );
  });

  it("should show View All for services when totalCount exceeds items length", () => {
    render(
      <PendingRequestsWidget
        rentalItems={[]}
        rentalTotalCount={0}
        serviceItems={[serviceItem]}
        serviceTotalCount={10}
      />,
    );

    const viewAll = screen.getByRole("link", { name: /View All/i });
    expect(viewAll).toHaveAttribute(
      "href",
      "/dashboard/services/incoming/pending",
    );
  });

  it("should not show View All when totalCount equals items length", () => {
    render(
      <PendingRequestsWidget
        rentalItems={[rentalItem]}
        rentalTotalCount={1}
        serviceItems={[]}
        serviceTotalCount={0}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /View All/i }),
    ).not.toBeInTheDocument();
  });
});
