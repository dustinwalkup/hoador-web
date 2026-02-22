import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { OverdueAlertsWidget } from "../overdue-alerts-widget";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("OverdueAlertsWidget", () => {
  it("should return null when items array is empty", () => {
    const { container } = render(<OverdueAlertsWidget items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render items with listing name, status text, other party and link", () => {
    const items = [
      {
        id: "req-1",
        listingName: "Power Drill",
        statusText: "3 days late",
        otherPartyName: "Jane Owner",
        linkTo: "/dashboard/rental/req-1",
      },
    ];
    render(<OverdueAlertsWidget items={items} />);

    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText(/3 days late/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Owner/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Power Drill/i });
    expect(link).toHaveAttribute("href", "/dashboard/rental/req-1");
  });

  it("should show badge with item count", () => {
    const items = [
      {
        id: "a",
        listingName: "A",
        statusText: "1 day late",
        otherPartyName: "X",
        linkTo: "/dashboard/rental/a",
      },
      {
        id: "b",
        listingName: "B",
        statusText: "2 days late",
        otherPartyName: "Y",
        linkTo: "/dashboard/rental/b",
      },
    ];
    render(<OverdueAlertsWidget items={items} />);
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });
});
