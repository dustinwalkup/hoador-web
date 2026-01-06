import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageUserButton } from "../message-user-button";
import { mockUser2 } from "@/test/fixtures/messages";

// Mock the modal component
vi.mock("../message-user-modal", () => ({
  MessageUserModal: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (open ? <div data-testid="message-modal">Message Modal</div> : null),
}));

describe("MessageUserButton", () => {
  it("should render button with default text", () => {
    // Arrange
    const props = {
      recipientId: mockUser2.id,
      recipientName: mockUser2.firstName,
      listingId: "listing-123",
      listingName: "Power Drill",
    };

    // Act
    render(<MessageUserButton {...props} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /Message Owner/i }),
    ).toBeInTheDocument();
  });

  it("should render button with custom text", () => {
    // Arrange
    const props = {
      recipientId: mockUser2.id,
      recipientName: mockUser2.firstName,
      listingId: "listing-123",
      listingName: "Power Drill",
      buttonText: "Contact Seller",
    };

    // Act
    render(<MessageUserButton {...props} />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Contact Seller" }),
    ).toBeInTheDocument();
  });

  it("should open modal when button is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const props = {
      recipientId: mockUser2.id,
      recipientName: mockUser2.firstName,
      listingId: "listing-123",
      listingName: "Power Drill",
    };

    render(<MessageUserButton {...props} />);

    // Act
    const button = screen.getByRole("button", { name: /Message Owner/i });
    await user.click(button);

    // Assert
    expect(screen.getByTestId("message-modal")).toBeInTheDocument();
  });

  it("should render message icon", () => {
    // Arrange
    const props = {
      recipientId: mockUser2.id,
      recipientName: mockUser2.firstName,
      listingId: "listing-123",
      listingName: "Power Drill",
    };

    // Act
    render(<MessageUserButton {...props} />);

    // Assert
    // Icon should be present inside the button (SVG with aria-hidden)
    const button = screen.getByRole("button", { name: /Message Owner/i });
    const icon = button.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("lucide-message-circle");
  });
});
