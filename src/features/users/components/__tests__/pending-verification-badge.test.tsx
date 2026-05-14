import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PendingVerificationBadge } from "../pending-verification-badge";

describe("PendingVerificationBadge", () => {
  it("renders the verification-pending label", () => {
    render(<PendingVerificationBadge />);
    expect(screen.getByText(/verification pending/i)).toBeInTheDocument();
  });

  it("explains that access is not blocked while pending", () => {
    render(<PendingVerificationBadge />);
    expect(
      screen.getByTitle(/full access while we review/i),
    ).toBeInTheDocument();
  });
});
