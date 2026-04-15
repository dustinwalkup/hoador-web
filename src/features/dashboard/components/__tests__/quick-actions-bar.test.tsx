import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { QuickActionsBar } from "../quick-actions-bar";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("QuickActionsBar", () => {
  it("should render List item, Browse controls and Messages link", () => {
    render(<QuickActionsBar />);
    expect(
      screen.getByRole("button", { name: /^List item$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Browse$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Messages/i })).toBeInTheDocument();
  });

  it("should point List dialog options to rental listings and service creation", async () => {
    const user = userEvent.setup();
    render(<QuickActionsBar />);
    await user.click(screen.getByRole("button", { name: /^List item$/i }));

    const rentalLink = await screen.findByRole("link", {
      name: /List a rental/i,
    });
    expect(rentalLink).toHaveAttribute("href", "/dashboard/listings/add");

    const serviceLink = screen.getByRole("link", { name: /Offer a service/i });
    expect(serviceLink).toHaveAttribute(
      "href",
      "/dashboard/services/listings/create",
    );
  });

  it("should point Browse popover options to explore and services", async () => {
    const user = userEvent.setup();
    render(<QuickActionsBar />);
    await user.click(screen.getByRole("button", { name: /^Browse$/i }));

    const rentalsLink = await screen.findByRole("link", {
      name: /Browse rentals/i,
    });
    expect(rentalsLink).toHaveAttribute("href", "/dashboard/explore");

    const servicesLink = screen.getByRole("link", { name: /Browse services/i });
    expect(servicesLink).toHaveAttribute("href", "/dashboard/services");
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

  it("should show unread badge on Messages when unreadCount is positive", () => {
    render(<QuickActionsBar unreadCount={3} />);
    expect(screen.getByLabelText(/3 unread messages/i)).toBeInTheDocument();
  });
});
