import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { OverdueAlertsWidget } from "../overdue-alerts-widget";
import type { ActionableAlert } from "@/dal/rentals.dal";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function buildAlert(
  overrides: Partial<ActionableAlert> &
    Pick<ActionableAlert, "id" | "alertType">,
): ActionableAlert {
  return {
    listingName: "Listing",
    userRole: "renter",
    deliveryRequested: false,
    otherPartyName: "Other",
    linkTo: "/dashboard/rental/x",
    severity: "error",
    ...overrides,
  };
}

describe("OverdueAlertsWidget", () => {
  it("should return null when alerts array is empty", () => {
    const { container } = render(<OverdueAlertsWidget alerts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render listing name, formatted copy, other party and link", () => {
    const alerts: ActionableAlert[] = [
      buildAlert({
        id: "req-1",
        alertType: "overdue_return",
        listingName: "Power Drill",
        userRole: "renter",
        deliveryRequested: false,
        daysLate: 3,
        otherPartyName: "Jane Owner",
        linkTo: "/dashboard/rental/req-1",
        severity: "error",
      }),
    ];
    render(<OverdueAlertsWidget alerts={alerts} />);

    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your return is 3 days overdue — return the item to the owner/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Jane Owner/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Power Drill/i });
    expect(link).toHaveAttribute("href", "/dashboard/rental/req-1");
  });

  it("should show badge with alert count", () => {
    const alerts: ActionableAlert[] = [
      buildAlert({ id: "a", alertType: "end_today", severity: "warning" }),
      buildAlert({ id: "b", alertType: "end_today", severity: "warning" }),
    ];
    render(<OverdueAlertsWidget alerts={alerts} />);
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });
});
