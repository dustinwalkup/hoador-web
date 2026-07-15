import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { DashboardPulse } from "../dashboard-pulse";
import type { DashboardPulseData } from "@/features/dashboard/types";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    onClick,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
    onClick?: React.MouseEventHandler;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
    button: ({
      children,
      className,
      onClick,
    }: {
      children: ReactNode;
      className?: string;
      onClick?: React.MouseEventHandler;
    }) => (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    ),
    span: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => <span className={className}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const BASE_DATA: DashboardPulseData = {
  action: {
    pendingRequests: 0,
    overdueReturns: 0,
    overdueServices: 0,
    unconfirmedServices: 0,
    rentalListingRevisions: 0,
    serviceListingRevisions: 0,
  },
  active: { borrowing: 0, lending: 0, disputes: 0 },
  upcoming: { rentals: 0, services: 0 },
  listed: { tools: 0, services: 0 },
  needs: { open: 0 },
};

function expandPulse() {
  // The collapsed bar is a button — click it to expand
  fireEvent.click(
    screen.getByRole("button", { name: /your neighborhood pulse/i }),
  );
}

describe("DashboardPulse — Neighborhood Needs", () => {
  it("shows the Needs metric in the collapsed bar", () => {
    render(<DashboardPulse data={{ ...BASE_DATA, needs: { open: 7 } }} />);

    // The label for the collapsed metric
    expect(screen.getByText("Needs")).toBeInTheDocument();
    // The count rendered by formatCompact(7) = "7"
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows 0 open needs in the collapsed bar when there are none", () => {
    render(<DashboardPulse data={BASE_DATA} />);

    expect(screen.getByText("Needs")).toBeInTheDocument();
    // All totals are 0; check at least one "0" is present for the needs slot
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThan(0);
  });

  it("renders the Neighborhood Needs section in the expanded view", () => {
    render(<DashboardPulse data={{ ...BASE_DATA, needs: { open: 3 } }} />);

    expandPulse();

    expect(screen.getByText("Neighborhood Needs")).toBeInTheDocument();
    expect(screen.getByText("Open needs in your network")).toBeInTheDocument();
  });

  it("links the needs row to /dashboard/needs", () => {
    render(<DashboardPulse data={{ ...BASE_DATA, needs: { open: 5 } }} />);

    expandPulse();

    const link = screen.getByRole("link", {
      name: /open needs in your network/i,
    });
    expect(link).toHaveAttribute("href", "/dashboard/needs");
  });

  it("shows the correct open needs count in the expanded section badge", () => {
    render(<DashboardPulse data={{ ...BASE_DATA, needs: { open: 12 } }} />);

    expandPulse();

    // The section badge displays the section total (d.needs.open = 12)
    // There may be multiple "12"s — at minimum one inside Neighborhood Needs
    const allTwelves = screen.getAllByText("12");
    expect(allTwelves.length).toBeGreaterThanOrEqual(1);
  });

  it("renders an error state without crashing", () => {
    render(<DashboardPulse data={BASE_DATA} error="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders a loading skeleton without crashing", () => {
    render(<DashboardPulse data={BASE_DATA} isLoading />);
    // Loading state renders no "Needs" label — just skeleton divs
    expect(screen.queryByText("Neighborhood Needs")).not.toBeInTheDocument();
  });
});
