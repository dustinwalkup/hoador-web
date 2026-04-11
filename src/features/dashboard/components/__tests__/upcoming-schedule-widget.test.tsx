import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpcomingScheduleWidget } from "../upcoming-schedule-widget";
import { ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children as ReactNode}</a>
  ),
}));

describe("UpcomingScheduleWidget", () => {
  it("should show empty state when entries length is 0", () => {
    render(<UpcomingScheduleWidget entries={[]} />);
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument();
    expect(screen.getByText("0 items")).toBeInTheDocument();
    expect(
      screen.getByText("Upcoming rentals and services will show here"),
    ).toBeInTheDocument();
  });

  it("should render entries with date, description, role badge, and link", () => {
    const entries = [
      {
        id: "rental-req-1-return-renter",
        date: new Date("2024-06-15"),
        description: "Return to Mike Owner",
        subtitle: "Power Drill",
        linkTo: "/dashboard/rental/req-1",
        type: "return" as const,
        role: "renter" as const,
      },
    ];
    render(<UpcomingScheduleWidget entries={entries} />);

    expect(screen.getByText("Return to Mike Owner")).toBeInTheDocument();
    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.getByText("Renter")).toBeInTheDocument();
    // Entry description is rendered as text; navigation is via next-step modal CTA.
    expect(screen.getByText("Return to Mike Owner")).toBeInTheDocument();
  });

  it("should show empty state or nothing scheduled when entries length 0", () => {
    render(<UpcomingScheduleWidget entries={[]} />);
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument();
  });
});
