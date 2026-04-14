import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { UnreadMessagesWidget } from "../unread-messages-widget";
import { mockConversationSummary } from "@/test/fixtures/messages";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("UnreadMessagesWidget", () => {
  it("should show empty state coaching when no unread and no recent conversations", () => {
    render(<UnreadMessagesWidget unreadCount={0} recentConversations={[]} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your conversations will appear here when you book or accept a rental or service",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Browse services")).toBeInTheDocument();
  });

  it("should render unread count when > 0", () => {
    render(<UnreadMessagesWidget unreadCount={3} recentConversations={[]} />);
    expect(screen.getByText("3 unread")).toBeInTheDocument();
  });

  it("should render recent conversations from props", () => {
    const conversations = [
      {
        ...mockConversationSummary,
        id: "conv-1",
        otherUser: { ...mockConversationSummary.otherUser, name: "Alice" },
      },
    ];
    render(
      <UnreadMessagesWidget
        unreadCount={0}
        recentConversations={conversations}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("should link to mailbox and conversation", () => {
    const conversations = [
      {
        ...mockConversationSummary,
        id: "conv-123",
        otherUser: { ...mockConversationSummary.otherUser, name: "Bob" },
      },
    ];
    render(
      <UnreadMessagesWidget
        unreadCount={0}
        recentConversations={conversations}
      />,
    );
    const mailboxLink = screen.getByRole("link", { name: /View messages/i });
    expect(mailboxLink).toHaveAttribute("href", "/dashboard/mailbox");
    const convLink = screen.getByRole("link", { name: /Bob/i });
    expect(convLink).toHaveAttribute(
      "href",
      "/dashboard/mailbox?conversation=conv-123",
    );
  });

  it("should show No recent conversations when unread but empty conversations", () => {
    render(<UnreadMessagesWidget unreadCount={1} recentConversations={[]} />);
    expect(screen.getByText("No recent conversations")).toBeInTheDocument();
  });
});
