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
  it("should return null when no unread and no recent conversations", () => {
    const { container } = render(
      <UnreadMessagesWidget unreadCount={0} recentConversations={[]} />,
    );
    expect(container.firstChild).toBeNull();
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
    const mailboxLink = screen.getByRole("link", { name: /View Mailbox/i });
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
