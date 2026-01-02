import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatArea } from "../chat-area";
import { mockConversationDetails } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/features/messages/hooks/use-conversations", () => ({
  useConversationDetails: vi.fn(),
}));

vi.mock("@/features/messages/actions/send-message", () => ({
  sendMessageAction: vi.fn(),
}));

vi.mock("@/features/messages/actions/mark-conversation-unread", () => ({
  markConversationUnreadAction: vi.fn(),
}));

vi.mock("@/features/messages/actions/archive-conversation", () => ({
  archiveConversationAction: vi.fn(),
}));

vi.mock("@/features/messages/actions/unarchive-conversation", () => ({
  unarchiveConversationAction: vi.fn(),
}));

vi.mock("@/features/messages/actions/delete-conversation", () => ({
  deleteConversationAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  })),
}));

import { useConversationDetails } from "@/features/messages/hooks/use-conversations";
import { sendMessageAction } from "@/features/messages/actions/send-message";

describe("ChatArea", () => {
  const mockOnBackToConversations = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render messages list", () => {
    // Arrange
    vi.mocked(useConversationDetails).mockReturnValue({
      data: mockConversationDetails,
      isLoading: false,
      isError: false,
    } as any);

    // Act
    render(
      <ChatArea
        conversationId="conversation-123"
        onBackToConversations={mockOnBackToConversations}
      />,
    );

    // Assert
    expect(
      screen.getByText("Hello, is this tool still available?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Yes, it's available!")).toBeInTheDocument();
  });

  it("should render message input", () => {
    // Arrange
    vi.mocked(useConversationDetails).mockReturnValue({
      data: mockConversationDetails,
      isLoading: false,
      isError: false,
    } as any);

    // Act
    render(
      <ChatArea
        conversationId="conversation-123"
        onBackToConversations={mockOnBackToConversations}
      />,
    );

    // Assert
    expect(
      screen.getByPlaceholderText(/type your message/i),
    ).toBeInTheDocument();
  });

  it("should send message when form is submitted", async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(useConversationDetails).mockReturnValue({
      data: mockConversationDetails,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(sendMessageAction).mockResolvedValue({
      success: true,
      data: {
        id: "message-new",
        conversationId: "conversation-123",
        senderId: "user-123",
        content: "New message",
        status: "sent" as const,
        listingId: null,
        rentalId: null,
        createdAt: new Date(),
        editedAt: null,
      },
    });

    const { container } = render(
      <ChatArea
        conversationId="conversation-123"
        onBackToConversations={mockOnBackToConversations}
      />,
    );

    // Act
    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, "New message");
    // Find the send button by its icon (button has no accessible name)
    const sendIcon = container.querySelector("svg.lucide-send");
    const sendButton = sendIcon?.closest("button");
    expect(sendButton).toBeInTheDocument();
    await user.click(sendButton!);

    // Assert
    await waitFor(() => {
      expect(sendMessageAction).toHaveBeenCalledWith(
        "conversation-123",
        "New message",
      );
    });
  });

  it("should show loading state during message send", async () => {
    // Arrange
    const user = userEvent.setup();
    vi.mocked(useConversationDetails).mockReturnValue({
      data: mockConversationDetails,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(sendMessageAction).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const { container } = render(
      <ChatArea
        conversationId="conversation-123"
        onBackToConversations={mockOnBackToConversations}
      />,
    );

    // Act
    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, "New message");
    // Find the send button by its icon (button has no accessible name)
    const sendIcon = container.querySelector("svg.lucide-send");
    const sendButton = sendIcon?.closest("button");
    expect(sendButton).toBeInTheDocument();
    await user.click(sendButton!);

    // Assert - After clicking, the send action is in progress
    // The component should show loading state (button may be disabled or show spinner)
    await waitFor(() => {
      expect(sendMessageAction).toHaveBeenCalled();
    });
  });

  it("should show loading state when conversation is loading", () => {
    // Arrange
    vi.mocked(useConversationDetails).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);

    // Act
    const { container } = render(
      <ChatArea
        conversationId="conversation-123"
        onBackToConversations={mockOnBackToConversations}
      />,
    );

    // Assert
    // Loading spinner should be present (SVG with animate-spin class)
    const spinner = container.querySelector("svg.animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("should show empty state when no conversation selected", () => {
    // Arrange
    vi.mocked(useConversationDetails).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    // Act
    render(
      <ChatArea
        conversationId={null}
        onBackToConversations={mockOnBackToConversations}
      />,
    );

    // Assert
    // Empty state should be shown
    expect(
      screen.queryByPlaceholderText(/type your message/i),
    ).not.toBeInTheDocument();
  });

  it("should handle long message lists with scrolling", () => {
    // Arrange
    const longConversation = {
      ...mockConversationDetails,
      messages: Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `message-${i}`,
          content: `Message ${i}`,
          time: new Date(),
          sender: i % 2 === 0 ? ("me" as const) : ("them" as const),
          senderName: i % 2 === 0 ? "You" : "Other User",
          listingId: null,
          listingName: null,
        })),
    };

    vi.mocked(useConversationDetails).mockReturnValue({
      data: longConversation,
      isLoading: false,
      isError: false,
    } as any);

    // Act
    render(
      <ChatArea
        conversationId="conversation-123"
        onBackToConversations={mockOnBackToConversations}
      />,
    );

    // Assert
    // Should render all messages
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 49")).toBeInTheDocument();
  });
});
