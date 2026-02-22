import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { RecentActivityFeed } from "../recent-activity-feed";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("RecentActivityFeed", () => {
  it("should show empty state when items length is 0", () => {
    render(<RecentActivityFeed items={[]} />);
    expect(screen.getByText("No recent activity")).toBeInTheDocument();
  });

  it("should render items with title, description, relativeTime and link", () => {
    const items = [
      {
        id: "act-1",
        title: "Rental approved",
        description: "Power Drill",
        timestamp: new Date(),
        relativeTime: "2 hours ago",
        linkTo: "/dashboard/rental/r1",
      },
    ];
    render(<RecentActivityFeed items={items} />);

    expect(screen.getByText("Rental approved")).toBeInTheDocument();
    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Rental approved/i });
    expect(link).toHaveAttribute("href", "/dashboard/rental/r1");
  });

  it("should render item without link when linkTo is missing", () => {
    const items = [
      {
        id: "act-2",
        title: "Listing created",
        description: "Saw",
        timestamp: new Date(),
        relativeTime: "1 day ago",
      },
    ];
    render(<RecentActivityFeed items={items} />);
    expect(screen.getByText("Listing created")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Listing created/i }),
    ).not.toBeInTheDocument();
  });
});
