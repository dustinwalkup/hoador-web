import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { QuickActionsBar } from "../quick-actions-bar";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("QuickActionsBar", () => {
  it("should render at least List something, Browse listings, Messages", () => {
    render(<QuickActionsBar />);
    expect(
      screen.getByRole("link", { name: /List something/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Browse listings/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Messages/i })).toBeInTheDocument();
  });

  it("should point List something to garage", () => {
    render(<QuickActionsBar />);
    const link = screen.getByRole("link", { name: /List something/i });
    expect(link).toHaveAttribute("href", "/dashboard/garage");
  });

  it("should point Browse listings to explore", () => {
    render(<QuickActionsBar />);
    const link = screen.getByRole("link", { name: /Browse listings/i });
    expect(link).toHaveAttribute("href", "/dashboard/explore");
  });

  it("should point Messages to mailbox", () => {
    render(<QuickActionsBar />);
    const link = screen.getByRole("link", { name: /Messages/i });
    expect(link).toHaveAttribute("href", "/dashboard/mailbox");
  });

  it("should have accessible nav with aria-label", () => {
    render(<QuickActionsBar />);
    const nav = screen.getByRole("navigation", { name: /Quick actions/i });
    expect(nav).toBeInTheDocument();
  });

  it("should render Rentals and Profile links", () => {
    render(<QuickActionsBar />);
    expect(screen.getByRole("link", { name: /Rentals/i })).toHaveAttribute(
      "href",
      "/dashboard/renting/requests",
    );
    expect(screen.getByRole("link", { name: /Profile/i })).toHaveAttribute(
      "href",
      "/dashboard/profile",
    );
  });
});
