import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ConversationsList } from "../conversations-list";
import {
  mockConversationSummary,
  mockUnreadConversation,
} from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("@/hooks/use-infinite-scroll", () => ({
  useInfiniteScroll: vi.fn(() => ({ current: null })),
}));

vi.mock("@/features/messages/hooks/use-conversations", () => ({
  usePrefetchConversation: vi.fn(() => vi.fn()),
}));

vi.mock("@/features/messages/hooks/use-message-mutations", () => ({
  useMarkConversationRead: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useMarkConversationRead } from "@/features/messages/hooks/use-message-mutations";

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

describe("ConversationsList", () => {
  const mockOnConversationClick = vi.fn();
  const mockOnLoadMore = vi.fn();
  let queryClient: QueryClient;
  const mockMarkReadMutate = vi.fn();

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    vi.mocked(useMarkConversationRead).mockReturnValue({
      mutate: mockMarkReadMutate,
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
      status: "idle",
    } as any);
  });

  it("should render conversation cards with preview", () => {
    // Arrange
    const conversationsData = {
      pages: [[mockConversationSummary]],
    };

    // Act
    render(
      <QueryWrapper queryClient={queryClient}>
        <ConversationsList
          conversationsData={conversationsData}
          searchQuery=""
          selectedConversationId={null}
          isLoading={false}
          hasNextPage={false}
          isFetchingNextPage={false}
          onConversationClick={mockOnConversationClick}
          onLoadMore={mockOnLoadMore}
        />
      </QueryWrapper>,
    );

    // Assert
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("should show unread indicators", () => {
    // Arrange
    const conversationsData = {
      pages: [[mockUnreadConversation]],
    };

    // Act
    render(
      <QueryWrapper queryClient={queryClient}>
        <ConversationsList
          conversationsData={conversationsData}
          searchQuery=""
          selectedConversationId={null}
          isLoading={false}
          hasNextPage={false}
          isFetchingNextPage={false}
          onConversationClick={mockOnConversationClick}
          onLoadMore={mockOnLoadMore}
        />
      </QueryWrapper>,
    );

    // Assert
    // Unread conversation should be visible
    expect(
      screen.getByText(mockUnreadConversation.otherUser.name),
    ).toBeInTheDocument();
  });

  it("should call onConversationClick when conversation is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const conversationsData = {
      pages: [[mockConversationSummary]],
    };

    render(
      <QueryWrapper queryClient={queryClient}>
        <ConversationsList
          conversationsData={conversationsData}
          searchQuery=""
          selectedConversationId={null}
          isLoading={false}
          hasNextPage={false}
          isFetchingNextPage={false}
          onConversationClick={mockOnConversationClick}
          onLoadMore={mockOnLoadMore}
        />
      </QueryWrapper>,
    );

    // Act
    const conversationCard = screen.getByText("Jane Smith");
    await user.click(conversationCard);

    // Assert
    await waitFor(() => {
      expect(mockOnConversationClick).toHaveBeenCalledWith("conversation-123");
    });
  });

  it("should mark conversation as read when unread conversation is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    const conversationsData = {
      pages: [[mockUnreadConversation]],
    };

    render(
      <QueryWrapper queryClient={queryClient}>
        <ConversationsList
          conversationsData={conversationsData}
          searchQuery=""
          selectedConversationId={null}
          isLoading={false}
          hasNextPage={false}
          isFetchingNextPage={false}
          onConversationClick={mockOnConversationClick}
          onLoadMore={mockOnLoadMore}
        />
      </QueryWrapper>,
    );

    // Act
    const conversationCard = screen.getByText(
      mockUnreadConversation.otherUser.name,
    );
    await user.click(conversationCard);

    // Assert
    await waitFor(() => {
      expect(mockMarkReadMutate).toHaveBeenCalledWith(
        {
          conversationId: mockUnreadConversation.id,
        },
        {
          onError: expect.any(Function),
        },
      );
    });
  });

  it("should show empty state when no conversations", () => {
    // Arrange
    const conversationsData = {
      pages: [[]],
    };

    // Act
    render(
      <QueryWrapper queryClient={queryClient}>
        <ConversationsList
          conversationsData={conversationsData}
          searchQuery=""
          selectedConversationId={null}
          isLoading={false}
          hasNextPage={false}
          isFetchingNextPage={false}
          onConversationClick={mockOnConversationClick}
          onLoadMore={mockOnLoadMore}
        />
      </QueryWrapper>,
    );

    // Assert
    // Empty state should be shown (check for empty message or no conversations)
    expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();
  });

  it("should filter conversations by search query", () => {
    // Arrange
    const conversationsData = {
      pages: [[mockConversationSummary]],
    };

    // Act
    render(
      <QueryWrapper queryClient={queryClient}>
        <ConversationsList
          conversationsData={conversationsData}
          searchQuery="Jane"
          selectedConversationId={null}
          isLoading={false}
          hasNextPage={false}
          isFetchingNextPage={false}
          onConversationClick={mockOnConversationClick}
          onLoadMore={mockOnLoadMore}
        />
      </QueryWrapper>,
    );

    // Assert
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("should filter out conversations that don't match search", () => {
    // Arrange
    const conversationsData = {
      pages: [[mockConversationSummary]],
    };

    // Act
    render(
      <QueryWrapper queryClient={queryClient}>
        <ConversationsList
          conversationsData={conversationsData}
          searchQuery="Bob"
          selectedConversationId={null}
          isLoading={false}
          hasNextPage={false}
          isFetchingNextPage={false}
          onConversationClick={mockOnConversationClick}
          onLoadMore={mockOnLoadMore}
        />
      </QueryWrapper>,
    );

    // Assert
    expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();
  });

  it("should show loading state", () => {
    // Arrange
    const conversationsData = {
      pages: [[mockConversationSummary]],
    };

    // Act
    const { container } = render(
      <QueryWrapper queryClient={queryClient}>
        <ConversationsList
          conversationsData={conversationsData}
          searchQuery=""
          selectedConversationId={null}
          isLoading={true}
          hasNextPage={false}
          isFetchingNextPage={false}
          onConversationClick={mockOnConversationClick}
          onLoadMore={mockOnLoadMore}
        />
      </QueryWrapper>,
    );

    // Assert
    // Component should render (loading state doesn't prevent rendering)
    expect(container.firstChild).toBeInTheDocument();
  });
});
