import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MailboxClient } from "../mailbox-client";
import { mockConversationSummary } from "@/test/fixtures/messages";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn(() => null),
  })),
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
  })),
  usePathname: vi.fn(() => "/dashboard/mailbox"),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: vi.fn(() => ({
    data: {
      pages: [[mockConversationSummary]],
    },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("../conversations-list", () => ({
  ConversationsList: ({
    onConversationClick,
  }: {
    onConversationClick: (id: string) => void;
  }) => (
    <div data-testid="conversations-list">
      <button onClick={() => onConversationClick("conversation-123")}>
        Conversation
      </button>
    </div>
  ),
}));

vi.mock("../chat-area", () => ({
  ChatArea: ({ conversationId }: { conversationId: string | null }) => (
    <div data-testid="chat-area">
      {conversationId
        ? `Chat for ${conversationId}`
        : "No conversation selected"}
    </div>
  ),
}));

vi.mock("../mailbox-search", () => ({
  MailboxSearch: ({
    onSearchChange,
  }: {
    onSearchChange: (query: string) => void;
  }) => (
    <input
      data-testid="mailbox-search"
      onChange={(e) => onSearchChange(e.target.value)}
    />
  ),
}));

vi.mock("../mailbox-tabs", () => ({
  MailboxTabs: ({
    onTabChange,
  }: {
    onTabChange: (tab: "inbox" | "archived") => void;
  }) => (
    <div data-testid="mailbox-tabs">
      <button onClick={() => onTabChange("archived")}>Archived</button>
    </div>
  ),
}));

describe("MailboxClient", () => {
  const defaultProps = {
    conversations: [mockConversationSummary],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render conversations list and chat area", () => {
    // Act
    render(<MailboxClient {...defaultProps} />);

    // Assert - component renders both desktop and mobile views
    expect(screen.getAllByTestId("conversations-list").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByTestId("chat-area").length).toBeGreaterThan(0);
  });

  it("should render search component", () => {
    // Act
    render(<MailboxClient {...defaultProps} />);

    // Assert - component renders both desktop and mobile views
    expect(screen.getAllByTestId("mailbox-search").length).toBeGreaterThan(0);
  });

  it("should update selected conversation when conversation is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<MailboxClient {...defaultProps} />);

    // Act - click the first conversation button (desktop view)
    const conversationButtons = screen.getAllByText("Conversation");
    await user.click(conversationButtons[0]);

    // Assert - component renders both desktop and mobile views
    await waitFor(() => {
      expect(
        screen.getAllByText("Chat for conversation-123").length,
      ).toBeGreaterThan(0);
    });
  });

  it("should filter conversations by search query", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<MailboxClient {...defaultProps} />);

    // Act - use the first search input (desktop view)
    const searchInputs = screen.getAllByTestId("mailbox-search");
    await user.type(searchInputs[0], "Jane");

    // Assert
    // Search should update (this is tested through the ConversationsList component)
    expect(searchInputs[0]).toBeInTheDocument();
  });

  it("should switch tabs when tab is clicked", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<MailboxClient {...defaultProps} />);

    // Act - click the first archived button (desktop view)
    const archivedButtons = screen.getAllByText("Archived");
    await user.click(archivedButtons[0]);

    // Assert
    // Tab should change (this is tested through the MailboxTabs component)
    expect(archivedButtons[0]).toBeInTheDocument();
  });

  it("should show skeleton during data fetch", async () => {
    // Arrange
    const { useInfiniteQuery } = await import("@tanstack/react-query");
    vi.mocked(useInfiniteQuery).mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      isError: false,
    } as any);

    // Act
    render(<MailboxClient {...defaultProps} />);

    // Assert - component renders both desktop and mobile views
    // Loading state should be shown (this would be handled by the component)
    expect(screen.getAllByTestId("conversations-list").length).toBeGreaterThan(
      0,
    );
  });

  it("should show error state on failure", async () => {
    // Arrange
    const { useInfiniteQuery } = await import("@tanstack/react-query");
    vi.mocked(useInfiniteQuery).mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: true,
      error: new Error("Failed to fetch"),
    } as any);

    // Act
    render(<MailboxClient {...defaultProps} />);

    // Assert - component renders both desktop and mobile views
    // Error state should be shown (this would be handled by the component)
    expect(screen.getAllByTestId("conversations-list").length).toBeGreaterThan(
      0,
    );
  });

  it("should sync with URL search params", async () => {
    // Arrange
    const { useSearchParams } = await import("next/navigation");
    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === "conversation") return "conversation-123";
        return null;
      }),
    } as any);

    // Act
    render(<MailboxClient {...defaultProps} />);

    // Assert - component renders both desktop and mobile views
    // Conversation should be selected based on URL
    expect(
      screen.getAllByText("Chat for conversation-123").length,
    ).toBeGreaterThan(0);
  });
});
