import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { PendingRequestsWidget } from "../pending-requests-widget";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("PendingRequestsWidget", () => {
  it("should return null when totalCount is 0", () => {
    const { container } = render(
      <PendingRequestsWidget items={[]} totalCount={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render listing name and requester with link to request detail only (no Accept/Decline)", () => {
    const items = [
      {
        id: "req-1",
        listingName: "Power Drill",
        requesterName: "Jane Doe",
        statusText: "Awaiting your response",
        requestDetailUrl: "/dashboard/rental/req-1?view=lending",
      },
    ];
    render(<PendingRequestsWidget items={items} totalCount={1} />);

    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Power Drill/i });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/rental/req-1?view=lending",
    );
    expect(
      screen.queryByRole("button", { name: /Accept/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Decline/i }),
    ).not.toBeInTheDocument();
  });

  it("should show View All link when totalCount exceeds items length", () => {
    const items = [
      {
        id: "req-1",
        listingName: "Drill",
        requesterName: "Bob",
        statusText: "Awaiting your response",
        requestDetailUrl: "/dashboard/rental/req-1?view=lending",
      },
    ];
    render(<PendingRequestsWidget items={items} totalCount={10} />);

    const viewAll = screen.getByRole("link", { name: /View All/i });
    expect(viewAll).toHaveAttribute(
      "href",
      "/dashboard/rentals/incoming/requests",
    );
  });

  it("should not show View All when totalCount equals items length", () => {
    const items = [
      {
        id: "req-1",
        listingName: "Drill",
        requesterName: "Bob",
        statusText: "Awaiting your response",
        requestDetailUrl: "/dashboard/rental/req-1?view=lending",
      },
    ];
    render(<PendingRequestsWidget items={items} totalCount={1} />);
    expect(
      screen.queryByRole("link", { name: /View All/i }),
    ).not.toBeInTheDocument();
  });
});
