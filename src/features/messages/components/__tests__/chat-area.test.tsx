import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatArea } from "../chat-area";
import { mockConversationDetails } from "@/test/fixtures/messages";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
vi.mock("@/features/messages/hooks/use-conversations", () => ({
  useConversationDetails: vi.fn(),
}));

vi.mock("@/features/messages/hooks/use-message-mutations", () => ({
  useSendMessage: vi.fn(),
  useMarkConversationUnread: vi.fn(),
  useArchiveConversation: vi.fn(),
  useUnarchiveConversation: vi.fn(),
  useDeleteConversation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useConversationDetails } from "@/features/messages/hooks/use-conversations";
import {
  useSendMessage,
  useMarkConversationUnread,
  useArchiveConversation,
  useUnarchiveConversation,
  useDeleteConversation,
} from "@/features/messages/hooks/use-message-mutations";

// Create test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Wrapper component for React Query
function QueryWrapper({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("ChatArea", () => {
  const mockOnBackToConversations = vi.fn();
  let queryClient: QueryClient;
  const mockSendMessageMutateAsync = vi.fn();

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    vi.mocked(useSendMessage).mockReturnValue({
      mutateAsync: mockSendMessageMutateAsync,
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
      status: "idle",
    } as any);
    vi.mocked(useMarkConversationUnread).mockReturnValue({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useArchiveConversation).mockReturnValue({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useUnarchiveConversation).mockReturnValue({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useDeleteConversation).mockReturnValue({
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
    } as any);
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
      <QueryWrapper queryClient={queryClient}>
        <ChatArea
          conversationId="conversation-123"
          onBackToConversations={mockOnBackToConversations}
        />
      </QueryWrapper>,
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
      <QueryWrapper queryClient={queryClient}>
        <ChatArea
          conversationId="conversation-123"
          onBackToConversations={mockOnBackToConversations}
        />
      </QueryWrapper>,
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

    mockSendMessageMutateAsync.mockResolvedValue({
      success: true,
      data: {
        id: "message-new",
        content: "New message",
        createdAt: new Date(),
        senderId: "user-123",
      },
    });

    const { container } = render(
      <QueryWrapper queryClient={queryClient}>
        <ChatArea
          conversationId="conversation-123"
          onBackToConversations={mockOnBackToConversations}
        />
      </QueryWrapper>,
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
      expect(mockSendMessageMutateAsync).toHaveBeenCalledWith({
        conversationId: "conversation-123",
        content: "New message",
      });
    });
  });

  it("should show loading state during message send", () => {
    // Arrange
    vi.mocked(useConversationDetails).mockReturnValue({
      data: mockConversationDetails,
      isLoading: false,
      isError: false,
    } as any);

    // Simulate loading state (isPending: true)
    vi.mocked(useSendMessage).mockReturnValue({
      mutateAsync: mockSendMessageMutateAsync,
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: true,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
      status: "pending",
    } as any);

    const { container } = render(
      <QueryWrapper queryClient={queryClient}>
        <ChatArea
          conversationId="conversation-123"
          onBackToConversations={mockOnBackToConversations}
        />
      </QueryWrapper>,
    );

    // Assert - Button should be disabled when isPending is true
    const sendIcon = container.querySelector("svg.lucide-send");
    const sendButton = sendIcon?.closest("button");
    expect(sendButton).toBeInTheDocument();
    expect(sendButton).toBeDisabled();
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
      <QueryWrapper queryClient={queryClient}>
        <ChatArea
          conversationId="conversation-123"
          onBackToConversations={mockOnBackToConversations}
        />
      </QueryWrapper>,
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
      <QueryWrapper queryClient={queryClient}>
        <ChatArea
          conversationId={null}
          onBackToConversations={mockOnBackToConversations}
        />
      </QueryWrapper>,
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
      <QueryWrapper queryClient={queryClient}>
        <ChatArea
          conversationId="conversation-123"
          onBackToConversations={mockOnBackToConversations}
        />
      </QueryWrapper>,
    );

    // Assert
    // Should render all messages
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 49")).toBeInTheDocument();
  });
});
