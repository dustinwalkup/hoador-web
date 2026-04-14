import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ActiveDisputesWidget } from "../active-disputes-widget";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ActiveDisputesWidget", () => {
  it("should render nothing when totalCount is 0", () => {
    const { container } = render(
      <ActiveDisputesWidget disputes={[]} totalCount={0} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render disputes from props with status and link to detail", () => {
    const disputes = [
      {
        id: "disp-1",
        status: "open",
        rental: {
          listing: { name: "Power Drill" },
        },
      },
    ] as any;
    render(<ActiveDisputesWidget disputes={disputes} totalCount={1} />);

    expect(screen.getByText("Power Drill")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Power Drill/i });
    expect(link).toHaveAttribute("href", "/dashboard/disputes/disp-1");
  });

  it("should show View All Disputes when totalCount > disputes length", () => {
    const disputes = [
      {
        id: "disp-1",
        status: "under_review",
        rental: { listing: { name: "Drill" } },
      },
    ] as any;
    render(<ActiveDisputesWidget disputes={disputes} totalCount={5} />);
    const viewAll = screen.getByRole("link", { name: /View All Disputes/i });
    expect(viewAll).toHaveAttribute("href", "/dashboard/disputes");
  });

  it("should format status with underscores as Title Case", () => {
    const disputes = [
      {
        id: "d1",
        status: "awaiting_evidence",
        rental: { listing: { name: "Saw" } },
      },
    ] as any;
    render(<ActiveDisputesWidget disputes={disputes} totalCount={1} />);
    expect(screen.getByText("Awaiting Evidence")).toBeInTheDocument();
  });
});
