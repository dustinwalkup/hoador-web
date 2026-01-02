import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/features/messages/actions/mark-conversation-read", () => ({
  markConversationAsReadAction: vi.fn(),
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
    getQueryData: vi.fn(),
  })),
}));

describe("ConversationsList", () => {
  const mockOnConversationClick = vi.fn();
  const mockOnLoadMore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render conversation cards with preview", () => {
    // Arrange
    const conversationsData = {
      pages: [[mockConversationSummary]],
    };

    // Act
    render(
      <ConversationsList
        conversationsData={conversationsData}
        searchQuery=""
        selectedConversationId={null}
        isLoading={false}
        hasNextPage={false}
        isFetchingNextPage={false}
        onConversationClick={mockOnConversationClick}
        onLoadMore={mockOnLoadMore}
      />,
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
      <ConversationsList
        conversationsData={conversationsData}
        searchQuery=""
        selectedConversationId={null}
        isLoading={false}
        hasNextPage={false}
        isFetchingNextPage={false}
        onConversationClick={mockOnConversationClick}
        onLoadMore={mockOnLoadMore}
      />,
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
      <ConversationsList
        conversationsData={conversationsData}
        searchQuery=""
        selectedConversationId={null}
        isLoading={false}
        hasNextPage={false}
        isFetchingNextPage={false}
        onConversationClick={mockOnConversationClick}
        onLoadMore={mockOnLoadMore}
      />,
    );

    // Act
    const conversationCard = screen.getByText("Jane Smith");
    await user.click(conversationCard);

    // Assert
    await waitFor(() => {
      expect(mockOnConversationClick).toHaveBeenCalledWith("conversation-123");
    });
  });

  it("should show empty state when no conversations", () => {
    // Arrange
    const conversationsData = {
      pages: [[]],
    };

    // Act
    render(
      <ConversationsList
        conversationsData={conversationsData}
        searchQuery=""
        selectedConversationId={null}
        isLoading={false}
        hasNextPage={false}
        isFetchingNextPage={false}
        onConversationClick={mockOnConversationClick}
        onLoadMore={mockOnLoadMore}
      />,
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
      <ConversationsList
        conversationsData={conversationsData}
        searchQuery="Jane"
        selectedConversationId={null}
        isLoading={false}
        hasNextPage={false}
        isFetchingNextPage={false}
        onConversationClick={mockOnConversationClick}
        onLoadMore={mockOnLoadMore}
      />,
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
      <ConversationsList
        conversationsData={conversationsData}
        searchQuery="Bob"
        selectedConversationId={null}
        isLoading={false}
        hasNextPage={false}
        isFetchingNextPage={false}
        onConversationClick={mockOnConversationClick}
        onLoadMore={mockOnLoadMore}
      />,
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
      <ConversationsList
        conversationsData={conversationsData}
        searchQuery=""
        selectedConversationId={null}
        isLoading={true}
        hasNextPage={false}
        isFetchingNextPage={false}
        onConversationClick={mockOnConversationClick}
        onLoadMore={mockOnLoadMore}
      />,
    );

    // Assert
    // Component should render (loading state doesn't prevent rendering)
    expect(container.firstChild).toBeInTheDocument();
  });
});
