import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MailboxSearch } from "../mailbox-search";

describe("MailboxSearch", () => {
  it("should render search input field", () => {
    // Arrange
    const mockOnSearchChange = vi.fn();

    // Act
    render(
      <MailboxSearch searchQuery="" onSearchChange={mockOnSearchChange} />,
    );

    // Assert
    expect(screen.getByPlaceholderText("Search messages")).toBeInTheDocument();
  });

  it("should display current search query", () => {
    // Arrange
    const mockOnSearchChange = vi.fn();
    const searchQuery = "John Doe";

    // Act
    render(
      <MailboxSearch
        searchQuery={searchQuery}
        onSearchChange={mockOnSearchChange}
      />,
    );

    // Assert
    const input = screen.getByPlaceholderText("Search messages");
    expect(input).toHaveValue(searchQuery);
  });

  it("should call onSearchChange when user types", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockOnSearchChange = vi.fn();

    render(
      <MailboxSearch searchQuery="" onSearchChange={mockOnSearchChange} />,
    );

    // Act
    const input = screen.getByPlaceholderText("Search messages");
    await user.type(input, "test");

    // Assert
    // Since this is a controlled input with searchQuery="" prop not updating,
    // each keystroke triggers onChange with just that character
    expect(mockOnSearchChange).toHaveBeenCalledTimes(4); // Once for each character
    expect(mockOnSearchChange).toHaveBeenNthCalledWith(1, "t");
    expect(mockOnSearchChange).toHaveBeenNthCalledWith(2, "e");
    expect(mockOnSearchChange).toHaveBeenNthCalledWith(3, "s");
    expect(mockOnSearchChange).toHaveBeenNthCalledWith(4, "t");
  });

  it("should render search icon", () => {
    // Arrange
    const mockOnSearchChange = vi.fn();

    // Act
    const { container } = render(
      <MailboxSearch searchQuery="" onSearchChange={mockOnSearchChange} />,
    );

    // Assert
    // SVG icon has aria-hidden="true", so we query by class
    const searchIcon = container.querySelector("svg.lucide-search");
    expect(searchIcon).toBeInTheDocument();
  });
});
