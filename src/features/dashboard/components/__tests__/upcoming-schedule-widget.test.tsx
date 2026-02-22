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
    expect(
      screen.getByText("Upcoming pickups and returns will show here"),
    ).toBeInTheDocument();
  });

  it("should render entries with date, description and link", () => {
    const entries = [
      {
        date: new Date("2024-06-15"),
        description: "Return due: Power Drill",
        linkTo: "/dashboard/rental/req-1",
        type: "return" as const,
      },
    ];
    render(<UpcomingScheduleWidget entries={entries} />);

    expect(screen.getByText("Return due: Power Drill")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Return due: Power Drill/i });
    expect(link).toHaveAttribute("href", "/dashboard/rental/req-1");
  });

  it("should show empty state or nothing scheduled when entries length 0", () => {
    render(<UpcomingScheduleWidget entries={[]} />);
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument();
  });
});
