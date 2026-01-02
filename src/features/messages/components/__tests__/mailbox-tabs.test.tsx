import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MailboxTabs } from "../mailbox-tabs";

describe("MailboxTabs", () => {
  it("should render tab buttons", () => {
    // Arrange
    const mockOnTabChange = vi.fn();

    // Act
    render(<MailboxTabs activeTab="inbox" onTabChange={mockOnTabChange} />);

    // Assert
    expect(screen.getByRole("button", { name: "Inbox" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Archived" }),
    ).toBeInTheDocument();
  });

  it("should highlight active tab", () => {
    // Arrange
    const mockOnTabChange = vi.fn();

    // Act
    render(<MailboxTabs activeTab="inbox" onTabChange={mockOnTabChange} />);

    // Assert
    const inboxButton = screen.getByRole("button", { name: "Inbox" });
    const archivedButton = screen.getByRole("button", { name: "Archived" });

    expect(inboxButton).toHaveClass("bg-white");
    expect(archivedButton).not.toHaveClass("bg-white");
  });

  it("should call onTabChange when tab is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockOnTabChange = vi.fn();

    render(<MailboxTabs activeTab="inbox" onTabChange={mockOnTabChange} />);

    // Act
    const archivedButton = screen.getByRole("button", { name: "Archived" });
    await user.click(archivedButton);

    // Assert
    expect(mockOnTabChange).toHaveBeenCalledWith("archived");
  });

  it("should highlight archived tab when active", () => {
    // Arrange
    const mockOnTabChange = vi.fn();

    // Act
    render(<MailboxTabs activeTab="archived" onTabChange={mockOnTabChange} />);

    // Assert
    const inboxButton = screen.getByRole("button", { name: "Inbox" });
    const archivedButton = screen.getByRole("button", { name: "Archived" });

    expect(archivedButton).toHaveClass("bg-white");
    expect(inboxButton).not.toHaveClass("bg-white");
  });
});
