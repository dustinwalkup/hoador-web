import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

import { PayoutReadinessBanner } from "../payout-readiness-banner";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const DISMISS_KEY = "payout-readiness-banner-dismissed";

describe("PayoutReadinessBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders not_started copy and Connect CTA", () => {
    render(<PayoutReadinessBanner onboardingStatus="not_started" />);
    expect(
      screen.getByText(
        "Connect your payout account so you can accept bookings the moment a request comes in.",
      ),
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Connect now" });
    expect(cta).toHaveAttribute(
      "href",
      "/dashboard/payments/earnings-and-payouts",
    );
  });

  it("renders pending copy and Finish setup CTA", () => {
    render(<PayoutReadinessBanner onboardingStatus="pending" />);
    expect(
      screen.getByText(
        "Finish setting up your payout account to accept bookings.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Finish setup" }),
    ).toBeInTheDocument();
  });

  it("renders restricted copy and Update CTA", () => {
    render(<PayoutReadinessBanner onboardingStatus="restricted" />);
    expect(
      screen.getByText(
        "Your payout account needs an update. Bookings can't be accepted until this is fixed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Update now" }),
    ).toBeInTheDocument();
  });

  it("hides itself and writes sessionStorage flag when dismissed", () => {
    render(<PayoutReadinessBanner onboardingStatus="pending" />);
    const dismiss = screen.getByRole("button", {
      name: "Dismiss payout setup reminder",
    });
    fireEvent.click(dismiss);
    expect(
      screen.queryByText(
        "Finish setting up your payout account to accept bookings.",
      ),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  it("does not render when the dismissal flag is already set in sessionStorage", () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    render(<PayoutReadinessBanner onboardingStatus="not_started" />);
    expect(
      screen.queryByText(
        "Connect your payout account so you can accept bookings the moment a request comes in.",
      ),
    ).not.toBeInTheDocument();
  });
});
