import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageUserModal } from "../message-user-modal";
import { mockUser1, mockUser2 } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/features/messages/actions/start-conversation", () => ({
  startConversationAction: vi.fn(),
}));

import { startConversationAction } from "@/features/messages/actions/start-conversation";

describe("MessageUserModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    recipientId: mockUser2.id,
    recipientName: `${mockUser2.firstName} ${mockUser2.lastName}`,
    listingId: "listing-123",
    listingName: "Power Drill",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render modal with message input", () => {
    // Act
    render(<MessageUserModal {...defaultProps} />);

    // Assert
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument();
  });

  it("should show validation error for empty message", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<MessageUserModal {...defaultProps} />);

    // Act
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/message is required/i)).toBeInTheDocument();
    });
  });

  it("should show validation error for message too short", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<MessageUserModal {...defaultProps} />);

    // Act
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, "short");
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(
        screen.getByText(/message must be at least 10 characters/i),
      ).toBeInTheDocument();
    });
  });

  it("should send message successfully", async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(startConversationAction).mockResolvedValue({
      success: true,
      conversationId: "conversation-123",
    });

    render(<MessageUserModal {...defaultProps} />);

    // Act
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, "Hello, is this tool still available?");
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(startConversationAction).toHaveBeenCalledWith(
        mockUser2.id,
        "listing-123",
        "Power Drill",
        "Hello, is this tool still available?",
      );
    });
  });

  it("should show loading state during send", async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(startConversationAction).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<MessageUserModal {...defaultProps} />);

    // Act
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, "Hello, is this tool still available?");
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sending/i }),
      ).toBeInTheDocument();
    });
  });

  it("should show error message on failure", async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(startConversationAction).mockResolvedValue({
      success: false,
      error: "Failed to send message",
    });

    render(<MessageUserModal {...defaultProps} />);

    // Act
    const textarea = screen.getByPlaceholderText(/message/i);
    await user.type(textarea, "Hello, is this tool still available?");
    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Failed to send message")).toBeInTheDocument();
    });
  });

  it("should close modal when close button is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const mockOnOpenChange = vi.fn();
    render(
      <MessageUserModal {...defaultProps} onOpenChange={mockOnOpenChange} />,
    );

    // Act
    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    // Assert
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
